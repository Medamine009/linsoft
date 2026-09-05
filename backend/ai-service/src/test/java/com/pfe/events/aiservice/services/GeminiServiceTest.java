package com.pfe.events.aiservice.services;

import com.pfe.events.aiservice.dto.ChatRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Client Gemini — comportement hors ligne.
 *
 * <p>On ne teste évidemment pas l'API de Google. Ce qui compte ici, et qui est
 * entièrement vérifiable, c'est que le service <b>ne lève jamais</b> et renvoie
 * un message exploitable dans les deux situations qui arrivent réellement en
 * production : clé absente (déploiement sans {@code GEMINI_API_KEY}) et appel
 * réseau en échec. Sans cela, le chatbot renverrait une 500 au participant.</p>
 */
class GeminiServiceTest {

    private GeminiService service;

    @BeforeEach
    void setUp() {
        service = new GeminiService();
        ReflectionTestUtils.setField(service, "model", "gemini-2.5-flash");
        ReflectionTestUtils.setField(service, "baseUrl", "https://generativelanguage.googleapis.com/v1beta");
    }

    private String chat() {
        return service.chat("instruction", null, "Quelles formations Kubernetes proposez-vous ?");
    }

    // ─────────────── Absence de configuration ───────────────

    @Test
    void chat_explainsHowToConfigureWhenTheKeyIsMissing() {
        ReflectionTestUtils.setField(service, "apiKey", "");

        String reply = chat();

        // Message d'aide plutôt qu'une erreur technique : c'est un participant
        // qui le lit dans la fenêtre de chat.
        assertTrue(reply.contains("GEMINI_API_KEY"), "le message doit nommer la variable à renseigner");
        assertTrue(reply.contains("aistudio.google.com"), "et indiquer où obtenir une clé");
    }

    @Test
    void chat_treatsNullKeyLikeAMissingOne() {
        ReflectionTestUtils.setField(service, "apiKey", null);

        assertTrue(chat().contains("GEMINI_API_KEY"));
    }

    @Test
    void chat_treatsThePlaceholderKeyAsUnconfigured() {
        // Valeur laissée telle quelle dans un .env recopié depuis l'exemple :
        // sans cette garde, on partirait faire un appel voué à un 400.
        ReflectionTestUtils.setField(service, "apiKey", "CHANGE_ME");
        assertTrue(chat().contains("GEMINI_API_KEY"));

        ReflectionTestUtils.setField(service, "apiKey", "change_me");
        assertTrue(chat().contains("GEMINI_API_KEY"), "la comparaison ignore la casse");
    }

    // ─────────────── Appel réseau en échec ───────────────

    @Test
    void chat_returnsAReadableFallbackWhenTheApiIsUnreachable() {
        ReflectionTestUtils.setField(service, "apiKey", "cle-factice-pour-le-test");
        // Hôte non routable : l'appel échoue à coup sûr, sans dépendre du réseau.
        ReflectionTestUtils.setField(service, "baseUrl", "http://127.0.0.1:1/v1beta");

        String reply = assertDoesNotThrow(this::chat);

        assertTrue(reply.contains("indisponible"), "le participant doit comprendre que c'est temporaire");
        assertFalse(reply.contains("Exception"), "aucune trace technique ne doit fuiter vers l'utilisateur");
    }

    @Test
    void chat_neverLeaksTheApiKeyInItsAnswer() {
        String secret = "AIzaSyFAUSSE-CLE-SECRETE-1234567890";
        ReflectionTestUtils.setField(service, "apiKey", secret);
        ReflectionTestUtils.setField(service, "baseUrl", "http://127.0.0.1:1/v1beta");

        // La clé est concaténée dans l'URL appelée : elle ne doit jamais
        // ressortir dans le message rendu à l'utilisateur.
        assertFalse(chat().contains(secret));
    }

    @Test
    void chat_toleratesAHistoryWithEmptyOrNullTurns() {
        ReflectionTestUtils.setField(service, "apiKey", "cle-factice");
        ReflectionTestUtils.setField(service, "baseUrl", "http://127.0.0.1:1/v1beta");

        List<ChatRequest.ChatTurn> history = Arrays.asList(
                null,
                turn("user", null),
                turn("user", "   "),
                turn("assistant", "Bonjour !"),
                turn("user", "Bonjour"));

        // Le front peut envoyer un historique partiellement vide : la construction
        // des tours doit l'ignorer sans planter.
        assertDoesNotThrow(() -> service.chat("instruction", history, "Et ensuite ?"));
    }

    private ChatRequest.ChatTurn turn(String role, String content) {
        ChatRequest.ChatTurn t = new ChatRequest.ChatTurn();
        t.setRole(role);
        t.setContent(content);
        return t;
    }

    // ─────────────── Modèle exposé ───────────────

    @Test
    void getModel_reportsTheConfiguredModel() {
        // Le modèle remonte jusqu'à l'interface (affiché sous la réponse) :
        // il doit refléter la configuration réelle, pas une valeur codée en dur.
        assertEquals("gemini-2.5-flash", service.getModel());

        ReflectionTestUtils.setField(service, "model", "gemini-2.0-flash");
        assertEquals("gemini-2.0-flash", service.getModel());
    }
}
