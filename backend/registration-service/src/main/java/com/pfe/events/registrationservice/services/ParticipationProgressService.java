package com.pfe.events.registrationservice.services;

import com.pfe.events.registrationservice.entities.Registration;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Avancement d'un participant dans une session, et clôture automatique.
 *
 * <p>L'avancement n'est pas déclaratif : il se déduit de faits que la plateforme
 * connaît déjà — la demande validée, l'heure de la session, le check-in scanné à
 * l'entrée, la fin de session. Quatre jalons, dans cet ordre :</p>
 *
 * <ol>
 *   <li><b>CONFIRMED</b> — inscription validée par un administrateur</li>
 *   <li><b>STARTED</b> — la session a commencé</li>
 *   <li><b>ATTENDED</b> — présence validée à l'entrée (check-in)</li>
 *   <li><b>COMPLETED</b> — la session est terminée</li>
 * </ol>
 *
 * <p>Un jalon non atteint alors que la session l'a dépassé est marqué
 * « manqué » plutôt que simplement « à faire » : un participant absent doit voir
 * que sa présence n'a pas été validée, sans que cela bloque la clôture.</p>
 */
@Service
public class ParticipationProgressService {

    /** Session sans durée renseignée : on la considère terminée en fin de journée. */
    private static final Duration DEFAULT_DURATION = Duration.ofHours(8);

    /** « 3 jours », « 4 heures », « 90 min », « 1 semaine »… */
    private static final Pattern DURATION_PART =
            Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*([a-zà-ÿ]*)", Pattern.CASE_INSENSITIVE);

    /** « 2h30 », « 2 h 30 » — heures et minutes accolées. */
    private static final Pattern HOURS_MINUTES =
            Pattern.compile("(\\d{1,2})\\s*h\\s*(\\d{1,2})\\b", Pattern.CASE_INSENSITIVE);

    /** Un jalon du parcours, tel qu'affiché dans le suivi participant. */
    public static class Step {
        public final String key;
        public final String label;
        public final boolean done;
        public final boolean missed;

        Step(String key, String label, boolean done, boolean missed) {
            this.key = key; this.label = label; this.done = done; this.missed = missed;
        }
    }

    // ═══════════════ Dates de session ═══════════════

    /** Début de la session, d'après la date dénormalisée sur l'inscription. */
    public LocalDateTime start(Registration reg) {
        return parseDate(reg.getEventDateStr());
    }

    /** Fin de la session = début + durée annoncée (défaut : une journée de formation). */
    public LocalDateTime end(Registration reg) {
        LocalDateTime start = start(reg);
        if (start == null) return null;
        return start.plus(parseDuration(reg.getEventDurationStr()));
    }

    /**
     * Traduit une durée libellée en durée réelle. Le champ est saisi librement par
     * le formateur : on lit ce qui est lisible et on retombe sur la journée type
     * plutôt que de clôturer une session trop tôt.
     */
    public Duration parseDuration(String label) {
        if (label == null || label.isBlank()) return DEFAULT_DURATION;
        String s = label.toLowerCase(Locale.FRENCH).trim();

        if (s.contains("demi") && (s.contains("jour") || s.contains("journ"))) return Duration.ofHours(4);

        // « 2h30 » / « 2 h 30 » : l'heure décomposée à la française, avant le
        // balayage générique qui prendrait « 30 » pour une seconde durée.
        Matcher hm = HOURS_MINUTES.matcher(s);
        if (hm.find()) {
            return Duration.ofHours(Long.parseLong(hm.group(1))).plusMinutes(Long.parseLong(hm.group(2)));
        }

        Duration total = Duration.ZERO;
        Matcher m = DURATION_PART.matcher(s);
        while (m.find()) {
            double unitMinutes = unitMinutes(m.group(2));
            if (unitMinutes <= 0) continue;   // nombre sans unité reconnue : on l'ignore
            try {
                long minutes = Math.round(Double.parseDouble(m.group(1).replace(',', '.')) * unitMinutes);
                if (minutes > 0) total = total.plusMinutes(minutes);
            } catch (NumberFormatException ignored) { }
        }
        return total.isZero() ? DEFAULT_DURATION : total;
    }

    /** Minutes que vaut une unité. 0 = unité absente ou non reconnue. */
    private double unitMinutes(String unit) {
        String u = unit == null ? "" : unit;
        if (u.startsWith("semaine")) return 7 * 24 * 60;
        if (u.startsWith("jour") || u.startsWith("journ") || u.equals("j")) return 24 * 60;
        if (u.startsWith("heure") || u.equals("h") || u.startsWith("hr")) return 60;
        if (u.startsWith("min")) return 1;
        return 0;
    }

    private LocalDateTime parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try { return LocalDateTime.parse(s); }
        catch (Exception ignored) { return null; }
    }

    // ═══════════════ Avancement ═══════════════

    /** Les quatre jalons du parcours, dans l'ordre d'affichage. */
    public List<Step> steps(Registration reg) {
        String status = upper(reg.getStatus());
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime start = start(reg);
        LocalDateTime end = end(reg);

        boolean confirmed = "CONFIRMED".equals(status);
        boolean started = confirmed && start != null && !now.isBefore(start);
        boolean finished = confirmed && end != null && now.isAfter(end);

        List<Step> steps = new ArrayList<>(4);
        steps.add(new Step("CONFIRMED", "Inscription validée", confirmed, false));
        steps.add(new Step("STARTED", "Session démarrée", started, false));
        // Présence : manquée seulement une fois la session terminée sans check-in.
        steps.add(new Step("ATTENDED", "Présence validée", reg.isCheckedIn(),
                finished && !reg.isCheckedIn()));
        steps.add(new Step("COMPLETED", "Session terminée", finished, false));
        return steps;
    }

    /**
     * Recalcule l'avancement et déclenche la clôture (certificat « en préparation »).
     *
     * @return {@code true} si l'inscription a changé et doit être enregistrée.
     */
    public boolean refresh(Registration reg) {
        String status = upper(reg.getStatus());
        String progress;
        int percent;

        if ("CANCELLED".equals(status) || "REJECTED".equals(status)) {
            progress = "CANCELLED";
            percent = 0;
        } else if (!"CONFIRMED".equals(status)) {
            // Demande encore en attente de validation : le parcours n'a pas commencé.
            progress = "NOT_STARTED";
            percent = 0;
        } else {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime start = start(reg);
            LocalDateTime end = end(reg);
            boolean started = start != null && !now.isBefore(start);
            boolean finished = end != null && now.isAfter(end);

            if (finished) {
                progress = "COMPLETED";
                percent = 100;
            } else if (started) {
                progress = "IN_PROGRESS";
                percent = reg.isCheckedIn() ? 75 : 50;
            } else {
                progress = "NOT_STARTED";
                percent = 25;
            }
        }

        boolean changed = false;
        if (!progress.equals(reg.getProgressStatus())) { reg.setProgressStatus(progress); changed = true; }
        if (percent != reg.getProgressPercent()) { reg.setProgressPercent(percent); changed = true; }

        if ("COMPLETED".equals(progress)) {
            if (reg.getCompletedAt() == null) { reg.setCompletedAt(end(reg)); changed = true; }
            // Clôture : le certificat entre automatiquement en préparation.
            String cert = upper(reg.getCertificateStatus());
            if (cert.isEmpty() || "NOT_AVAILABLE".equals(cert)) {
                reg.setCertificateStatus("IN_PREPARATION");
                changed = true;
            }
        } else if (reg.getCertificateStatus() == null) {
            reg.setCertificateStatus("NOT_AVAILABLE");
            changed = true;
        }

        return changed;
    }

    private String upper(String s) { return s == null ? "" : s.toUpperCase(); }
}
