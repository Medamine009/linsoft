package com.pfe.events.registrationservice.services;

import com.pfe.events.registrationservice.entities.Registration;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Génération du certificat de participation (PDF).
 *
 * <p>Ce composant dessine directement dans le document : positions absolues,
 * polices, cercles, filigrane. Rien n'est vérifié par le compilateur, et une
 * régression ne se voit qu'à l'ouverture du fichier — ou pire, par une exception
 * au moment où l'administrateur délivre le certificat.</p>
 *
 * <p>On vérifie donc ce qui est objectivement vérifiable : le document est un
 * PDF valide, il contient les mentions attendues, et il se génère malgré des
 * données incomplètes plutôt que d'échouer.</p>
 */
class CertificateServiceTest {

    private final CertificateService service = new CertificateService();

    private Registration complete() {
        Registration r = new Registration();
        r.setId("6a9ab2995adad1ef0a8de682");
        r.setAttendeeName("Yassine Gharbi");
        r.setEventTitle("Kubernetes Administrator (CKA)");
        r.setEventLocation("LINSOFT Academy — Tunis");
        r.setEventDateStr("2026-08-17T09:00");
        r.setStatus("CONFIRMED");
        return r;
    }

    /**
     * Enveloppe brute du document.
     *
     * <p>OpenPDF compresse les flux de contenu : le texte affiché n'est donc pas
     * lisible dans les octets. Seule la structure du fichier (en-tête, fin de
     * document) l'est. Vérifier le contenu textuel exigerait un analyseur PDF,
     * dépendance disproportionnée ici — on prouve plutôt l'incorporation des
     * données par comparaison de documents (voir plus bas).</p>
     */
    private String envelope(byte[] pdf) {
        return new String(pdf, StandardCharsets.ISO_8859_1);
    }

    @Test
    void generate_producesAValidPdfDocument() {
        byte[] pdf = service.generate(complete());

        assertNotNull(pdf);
        assertTrue(pdf.length > 1000, "un certificat vide signalerait un échec silencieux");
        assertEquals("%PDF", new String(pdf, 0, 4, StandardCharsets.ISO_8859_1));
        assertTrue(envelope(pdf).contains("%%EOF"), "document correctement terminé");
    }

    @Test
    void generate_actuallyIncorporatesTheHolderName() {
        // Si le nom n'était pas dessiné, deux titulaires différents donneraient
        // exactement le même document. La comparaison le prouve sans analyseur PDF.
        Registration court = complete();
        court.setAttendeeName("Ali B");
        Registration long_ = complete();
        long_.setAttendeeName("Yassine Gharbi-Benmansour-Trabelsi");

        assertNotEquals(service.generate(court).length, service.generate(long_).length,
                "le nom du titulaire doit influencer le document produit");
    }

    @Test
    void generate_actuallyIncorporatesTheSessionTitle() {
        Registration a = complete();
        a.setEventTitle("CKA");
        Registration b = complete();
        b.setEventTitle("Red Hat System Administration I — parcours complet RHCSA");

        assertNotEquals(service.generate(a).length, service.generate(b).length);
    }

    @Test
    void shortRef_usesTheDistinctivePartOfAnObjectId() {
        // Deux inscriptions créées dans la même seconde : leurs ObjectId
        // partagent les huit premiers caractères (l'horodatage). Prendre le
        // début produisait donc la même référence pour toute une promotion.
        String a = "6a9b659d2b6b63f3e38de66e";
        String b = "6a9b659d2b6b63f3e38de673";
        assertEquals(a.substring(0, 8), b.substring(0, 8), "prémisse : même horodatage");

        assertNotEquals(CertificateService.shortRef(a), CertificateService.shortRef(b),
                "la référence doit distinguer deux dossiers du même lot");
        assertEquals("E38DE66E", CertificateService.shortRef(a));
    }

    @Test
    void shortRef_handlesShortOrMissingIdentifiers() {
        assertEquals("—", CertificateService.shortRef(null));
        assertEquals("—", CertificateService.shortRef("  "));
        assertEquals("AB", CertificateService.shortRef("ab"));
    }

    @Test
    void generate_referenceVariesWithTheRegistrationId() {
        // La référence courte (8 premiers caractères de l'identifiant) rend la
        // pièce rattachable à un dossier : elle doit bien dépendre de l'inscription.
        Registration a = complete();
        a.setId("aaaaaaaaaaaaaaaaaaaaaaaa");
        Registration b = complete();
        b.setId("bbbbbbbbbbbbbbbbbbbbbbbb");

        assertFalse(java.util.Arrays.equals(service.generate(a), service.generate(b)),
                "deux inscriptions distinctes ne peuvent pas produire un document identique");
    }

    @Test
    void generate_fallsBackWhenTheHolderNameIsMissing() {
        Registration missing = complete();
        missing.setAttendeeName(null);

        Registration fallback = complete();
        fallback.setAttendeeName("Participant");   // mention neutre attendue

        // Un nom absent (compte supprimé, enrichissement en échec) ne doit pas
        // faire échouer la délivrance : le document produit est celui du repli.
        assertEquals(service.generate(fallback).length, service.generate(missing).length, 40);
    }

    @Test
    void generate_fallsBackWhenTheSessionTitleIsMissing() {
        Registration missing = complete();
        missing.setEventTitle(null);

        Registration fallback = complete();
        fallback.setEventTitle("Formation LINSOFT");

        assertEquals(service.generate(fallback).length, service.generate(missing).length, 40);
    }

    @Test
    void generate_worksWithoutDateOrLocation() {
        Registration r = complete();
        r.setEventDateStr(null);
        r.setEventLocation(null);

        byte[] pdf = assertDoesNotThrow(() -> service.generate(r));
        assertTrue(pdf.length > 1000);
    }

    @Test
    void generate_toleratesAnEmptyRegistration() {
        // Cas extrême : rien n'est renseigné. La génération doit rester possible,
        // sinon l'administrateur verrait une erreur 500 au moment de délivrer.
        byte[] pdf = assertDoesNotThrow(() -> service.generate(new Registration()));

        assertEquals("%PDF", new String(pdf, 0, 4, StandardCharsets.ISO_8859_1));
        assertTrue(envelope(pdf).contains("%%EOF"));
    }

    @Test
    void generate_toleratesAShortIdentifier() {
        Registration r = complete();
        r.setId("ab");   // plus court que la référence de 8 caractères

        assertDoesNotThrow(() -> service.generate(r));
    }

    @Test
    void generate_isDeterministicInSize() {
        // Deux appels sur les mêmes données produisent un document équivalent :
        // pas de contenu aléatoire qui rendrait la pièce non reproductible.
        int first = service.generate(complete()).length;
        int second = service.generate(complete()).length;

        assertEquals(first, second, 200);
    }
}
