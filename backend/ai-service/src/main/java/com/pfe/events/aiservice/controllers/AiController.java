package com.pfe.events.aiservice.controllers;

import com.pfe.events.aiservice.dto.ChatRequest;
import com.pfe.events.aiservice.dto.ChatResponse;
import com.pfe.events.aiservice.services.CatalogService;
import com.pfe.events.aiservice.services.FeedbackClient;
import com.pfe.events.aiservice.services.GeminiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final GeminiService gemini;
    private final CatalogService catalog;
    private final FeedbackClient feedbackClient;

    public AiController(GeminiService gemini, CatalogService catalog, FeedbackClient feedbackClient) {
        this.gemini = gemini;
        this.catalog = catalog;
        this.feedbackClient = feedbackClient;
    }

    /** Vérification rapide (publique). */
    @GetMapping("/ping")
    public Map<String, Object> ping() {
        return Map.of("status", "ok", "service", "ai-service", "model", gemini.getModel());
    }

    /** POST /api/ai/chat — l'assistant IA de LINSOFT Learning Center. */
    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(
            @RequestBody ChatRequest request,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        if (request == null || request.getMessage() == null || request.getMessage().isBlank()) {
            return ResponseEntity.badRequest().body(new ChatResponse("Message vide.", gemini.getModel()));
        }

        // On transmet le token du participant pour récupérer le catalogue réel
        String bearer = (authHeader != null && authHeader.startsWith("Bearer "))
                ? authHeader.substring(7) : null;
        String catalogSummary = catalog.publishedSummary(bearer);

        String system = buildSystemPrompt(catalogSummary);
        String reply = gemini.chat(system, request.getHistory(), request.getMessage());

        return ResponseEntity.ok(new ChatResponse(reply, gemini.getModel()));
    }

    /**
     * POST /api/ai/feedback-analysis  { "eventId": "..." }
     * Analyse de sentiment + synthèse des avis d'une session par l'IA.
     */
    @PostMapping("/feedback-analysis")
    public ResponseEntity<Map<String, Object>> analyzeFeedback(@RequestBody Map<String, String> body) {
        String eventId = body == null ? null : body.get("eventId");
        if (eventId == null || eventId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "eventId requis"));
        }

        FeedbackClient.Result fb = feedbackClient.fetch(eventId);
        Map<String, Object> res = new HashMap<>();
        res.put("count", fb.count);
        res.put("model", gemini.getModel());

        if (fb.count == 0) {
            res.put("analysis", "Aucun avis n'a encore été laissé sur cette session.");
            return ResponseEntity.ok(res);
        }

        String system = "Tu es un analyste L&D. On te fournit les avis (note sur 5 + commentaire) laissés "
                + "après une formation LINSOFT. Rédige une synthèse courte en français avec EXACTEMENT ces "
                + "sections en gras :\n"
                + "**Sentiment global** : positif / mitigé / négatif (+ une phrase).\n"
                + "**Points forts** : 2 à 3 puces.\n"
                + "**Axes d'amélioration** : 2 à 3 puces.\n"
                + "Reste factuel et base-toi uniquement sur les avis fournis.";
        String analysis = gemini.chat(system, null, "Voici les " + fb.count + " avis :\n" + fb.text);
        res.put("analysis", analysis);
        return ResponseEntity.ok(res);
    }

    private String buildSystemPrompt(String catalogSummary) {
        String knowledge = """
            Tu es « LINA », l'assistant virtuel officiel de LINSOFT Learning Center — la plateforme interne
            de LINSOFT pour gérer et suivre les événements, formations et séminaires de l'entreprise.

            ═══ À PROPOS DE LINSOFT ═══
            LINSOFT est un centre de compétences et de formation IT, partenaire/centre certifié Red Hat et AWS.
            Sa mission : monter en compétences ses collaborateurs et ses partenaires sur les technologies clés du cloud,
            de l'open source et du DevOps. La plateforme « LINSOFT Learning Center » centralise tout le catalogue de
            formation et d'événements internes.
            Domaines de prédilection : Cloud (AWS), Linux & Red Hat (RHEL, OpenShift, Ansible), DevOps & conteneurs
            (Docker, Kubernetes, CI/CD), cybersécurité, développement logiciel, bases de données & data, et soft skills.

            ═══ CE QUE GÈRE LA PLATEFORME ═══
            LINSOFT Learning Center permet de publier, découvrir et suivre 5 natures de sessions :
            - FORMATION  : parcours certifiant ou qualifiant (souvent Red Hat / AWS), avec niveau et prérequis.
            - WORKSHOP   : atelier pratique, hands-on, en petit groupe.
            - CONFÉRENCE : intervention d'un ou plusieurs speakers sur un sujet.
            - SÉMINAIRE  : session thématique plus longue (souvent sur plusieurs demi-journées).
            - ÉVÉNEMENT  : tout autre événement interne LINSOFT (meetup, webinaire, journée technique…).
            Chaque session a : un titre, une catégorie, un niveau (Débutant / Intermédiaire / Avancé), une durée,
            des prérequis, un format (PRÉSENTIEL, EN LIGNE ou HYBRIDE, avec lien visio le cas échéant), un lieu,
            une date/heure, un nombre de places, et éventuellement une certification visée et un intervenant.

            ═══ COMMENT ÇA MARCHE (parcours d'un collaborateur) ═══
            1. Il parcourt le CATALOGUE (filtres par type, niveau, format, éditeur) ou le PLANNING mensuel.
            2. Il ouvre une session pour voir le détail (description, prérequis, lieu/visio, places restantes, avis).
            3. Il clique sur « Participer » pour s'inscrire (aucun paiement — outil interne, tout est gratuit).
            4. Il reçoit un billet QR par email et le retrouve dans « Mes inscriptions ».
            5. Le jour J, l'organisateur scanne son QR pour le check-in (validation de présence).
            6. Après la session, il peut télécharger son CERTIFICAT DE PARTICIPATION (PDF) et laisser un AVIS (note + commentaire).

            ═══ RÔLES ═══
            - PARTICIPANT  : s'inscrit, participe, récupère billet + certificat, laisse des avis.
            - ORGANISATEUR / FORMATEUR : crée et anime des sessions, gère les inscriptions, fait le check-in.
            - ADMIN        : modère (approuve/refuse) les publications, gère les comptes et les rôles, voit les statistiques.
            L'authentification se fait via le compte d'entreprise (Keycloak / OAuth2).

            ═══ RÈGLES DE RÉPONSE ═══
            - Réponds en français, de façon concise, chaleureuse et professionnelle (pas de blabla, va à l'essentiel).
            - Reste dans le périmètre : formations/événements/séminaires LINSOFT et usage de la plateforme.
            - Ne promets jamais d'inscrire toi-même : explique le chemin (Catalogue → une session → bouton « Participer »).
            - N'INVENTE PAS de sessions absentes du catalogue ci-dessous, ni de faits précis sur LINSOFT que tu ignores
              (tarifs, adresse, RH, dates exactes) : dans ce cas, invite poliment à contacter un organisateur/administrateur.
            - Si on te demande une recommandation, appuie-toi sur le catalogue réel et le profil (niveau, domaine).

            """;

        StringBuilder sb = new StringBuilder(knowledge);
        if (catalogSummary != null && !catalogSummary.isBlank()) {
            sb.append("═══ CATALOGUE ACTUELLEMENT PUBLIÉ (données temps réel) ═══\n").append(catalogSummary).append("\n");
        } else {
            sb.append("(Le catalogue temps réel est momentanément indisponible — réponds de façon générale ")
              .append("et invite l'utilisateur à consulter la page Catalogue.)\n");
        }
        return sb.toString();
    }
}
