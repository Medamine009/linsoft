package com.pfe.events.notificationservice.controllers;

import com.pfe.events.notificationservice.entities.InAppMessage;
import com.pfe.events.notificationservice.repositories.InAppMessageRepository;
import com.pfe.events.notificationservice.services.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Endpoints REST du notification-service.
 * Le broadcast permet à un administrateur d'écrire à un groupe de participants ;
 * chaque message est aussi stocké pour que le destinataire le retrouve in-app.
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private EmailService emailService;

    @Autowired
    private InAppMessageRepository messageRepository;

    /** Adresse email « raisonnable » — on refuse ce qui ne pourra jamais partir. */
    private static final Pattern EMAIL_RE =
            Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    /**
     * Diffusion d'un message par email + livraison in-app à une liste de destinataires
     * (ADMIN uniquement). Fonctionne pour 1, plusieurs ou tous les participants : la
     * sélection est faite côté appelant, ce endpoint reçoit simplement la liste.
     *
     * <p>Robustesse : la liste est nettoyée (trim / dédoublonnage insensible à la casse /
     * validation), et chaque destinataire est traité isolément — un email en échec
     * n'interrompt pas la diffusion. La réponse détaille ce qui est parti et ce qui a
     * échoué pour que l'interface affiche un message clair.</p>
     */
    @PostMapping("/broadcast")
    public ResponseEntity<Map<String, Object>> broadcast(@RequestBody(required = false) BroadcastRequest req) {
        if (req == null || req.subject == null || req.subject.isBlank()) {
            return error("L'objet du message est obligatoire.");
        }
        if (req.message == null || req.message.isBlank()) {
            return error("Le corps du message est obligatoire.");
        }
        if (req.recipients == null || req.recipients.isEmpty()) {
            return error("Aucun destinataire sélectionné.");
        }

        // Nettoyage : trim, dédoublonnage insensible à la casse, ordre conservé
        List<String> valid = new ArrayList<>();
        List<String> invalid = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String to : req.recipients) {
            if (to == null || to.isBlank()) continue;
            String email = to.trim();
            if (!seen.add(email.toLowerCase())) continue;      // doublon
            if (EMAIL_RE.matcher(email).matches()) valid.add(email);
            else invalid.add(email);
        }

        if (valid.isEmpty()) {
            return error(invalid.isEmpty()
                    ? "Aucun destinataire valide dans la sélection."
                    : "Aucune adresse email valide dans la sélection (" + invalid.size() + " rejetée(s)).");
        }

        String subject = req.subject.trim();
        String message = req.message.trim();
        String html = wrap(subject, message);

        int sent = 0;
        List<String> failed = new ArrayList<>();
        for (String email : valid) {
            boolean ok;
            try {
                ok = emailService.sendHtml(email, subject, html);
            } catch (Exception e) {                            // filet de sécurité
                ok = false;
            }
            // Livraison in-app : indépendante de l'email, le destinataire retrouve
            // le message dans sa boîte de réception même si le SMTP est indisponible.
            try {
                messageRepository.save(new InAppMessage(email, subject, message, "ADMIN"));
            } catch (Exception ignored) { }

            if (ok) sent++; else failed.add(email);
        }

        Map<String, Object> body = new HashMap<>();
        body.put("sent", sent);
        body.put("requested", valid.size() + invalid.size());
        body.put("delivered", valid.size());       // livrés in-app (toujours)
        body.put("failed", failed.size());
        body.put("failedRecipients", failed);
        body.put("invalidRecipients", invalid);
        return ResponseEntity.ok(body);
    }

    /** Réponse 400 avec un message lisible par l'interface (jamais un corps vide). */
    private ResponseEntity<Map<String, Object>> error(String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", message);
        return ResponseEntity.badRequest().body(body);
    }

    /** GET /inbox — messages in-app du destinataire connecté (identifié par l'email de son JWT). */
    @GetMapping("/inbox")
    public ResponseEntity<List<InAppMessage>> inbox(@AuthenticationPrincipal Jwt jwt) {
        String email = jwt != null ? jwt.getClaimAsString("email") : null;
        if (email == null || email.isBlank()) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(messageRepository.findByRecipientEmailIgnoreCaseOrderByCreatedAtDesc(email));
    }

    /** PUT /inbox/{id}/read — marque un message comme lu (uniquement le sien). */
    @PutMapping("/inbox/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable String id, @AuthenticationPrincipal Jwt jwt) {
        String email = jwt != null ? jwt.getClaimAsString("email") : null;
        return messageRepository.findById(id).map(m -> {
            if (email != null && email.equalsIgnoreCase(m.getRecipientEmail())) {
                m.setRead(true);
                messageRepository.save(m);
                return ResponseEntity.ok().<Void>build();
            }
            return ResponseEntity.status(403).<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Habille le message libre de l'admin dans le gabarit LINSOFT. */
    private String wrap(String subject, String message) {
        String safeMsg = message
                .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\n", "<br>");
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>"
            + "<body style='font-family:Inter,Arial,sans-serif;background:#fafafa;padding:40px 20px;margin:0;color:#0a0a0a;'>"
            + "<div style='max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);'>"
            + "<div style='background:linear-gradient(135deg,#e2231a,#c41d14);padding:32px 30px;color:white;'>"
            + "<div style='font-size:18px;font-weight:700;letter-spacing:-0.3px;margin-bottom:4px;'>LINSOFT Learning Center</div>"
            + "<h1 style='margin:8px 0 0;font-size:22px;font-weight:700;letter-spacing:-0.5px;'>" + escape(subject) + "</h1>"
            + "</div>"
            + "<div style='padding:32px 30px;'>"
            + "<p style='margin:0 0 24px;font-size:15px;line-height:1.7;color:#0a0a0a;'>" + safeMsg + "</p>"
            + "<a href='http://localhost:4200' style='display:inline-block;background:#e2231a;color:white;padding:11px 22px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;'>Ouvrir la plateforme</a>"
            + "</div>"
            + "<div style='padding:18px 30px;background:#f7f7f8;border-top:1px solid #ececef;font-size:12px;color:#8e8e93;'>"
            + "Message envoyé par l'équipe LINSOFT Learning Center. © 2026"
            + "</div></div></body></html>";
    }

    private String escape(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    /** Corps de la requête de diffusion. */
    public static class BroadcastRequest {
        public String subject;
        public String message;
        public List<String> recipients;
    }
}
