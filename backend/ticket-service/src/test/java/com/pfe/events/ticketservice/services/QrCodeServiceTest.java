package com.pfe.events.ticketservice.services;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Génération des QR codes (billets et vérification publique).
 *
 * <p>Le QR est le support physique du billet : s'il est illisible ou s'il encode
 * autre chose que l'URL attendue, le contrôle à l'entrée devient impossible.
 * Ces tests relisent réellement l'image produite plutôt que de se contenter de
 * vérifier qu'un tableau d'octets non vide est renvoyé.</p>
 */
class QrCodeServiceTest {

    private final QrCodeService service = new QrCodeService();

    /** Décode l'image comme le ferait un téléphone à l'entrée de la session. */
    private String decode(byte[] png) throws Exception {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(png));
        assertNotNull(image, "les octets produits doivent être une image lisible");
        return new MultiFormatReader()
                .decode(new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(image))))
                .getText();
    }

    @Test
    void generatePng_producesAReadablePngImage() throws Exception {
        byte[] png = service.generatePng("LINSOFT-TICKET-abc123", 240);

        assertNotNull(png);
        assertTrue(png.length > 100);
        // Signature de fichier PNG.
        assertEquals((byte) 0x89, png[0]);
        assertEquals('P', png[1]);
        assertEquals('N', png[2]);
        assertEquals('G', png[3]);
    }

    @Test
    void generatePng_encodesExactlyWhatWasAsked() throws Exception {
        String content = "LINSOFT-TICKET-6a9ab2995adad1ef0a8de682";

        assertEquals(content, decode(service.generatePng(content, 240)));
    }

    @Test
    void generatePng_survivesAFullTicketUrl() throws Exception {
        // Cas réel : le QR encode l'URL publique du billet, avec ses `/` et `:`.
        String url = "http://localhost:4200/ticket/6a9ab2995adad1ef0a8de682";

        assertEquals(url, decode(service.generatePng(url, 300)));
    }

    @Test
    void generatePng_preservesAccentedContent() throws Exception {
        // L'encodage UTF-8 est explicitement demandé au générateur : sans lui,
        // un intitulé accentué reviendrait corrompu au scan.
        String content = "Sécurité des conteneurs — Durcissement";

        assertEquals(content, decode(service.generatePng(content, 300)));
    }

    @Test
    void generatePng_honoursTheRequestedSize() throws Exception {
        BufferedImage small = ImageIO.read(new ByteArrayInputStream(service.generatePng("abc", 120)));
        BufferedImage large = ImageIO.read(new ByteArrayInputStream(service.generatePng("abc", 480)));

        assertEquals(120, small.getWidth());
        assertEquals(480, large.getWidth());
        assertEquals(small.getWidth(), small.getHeight(), "le QR est carré");
    }

    @Test
    void generatePng_isDeterministicForTheSameInput() throws Exception {
        // Deux billets identiques doivent produire exactement la même image :
        // le QR est mis en cache une heure côté HTTP.
        assertArrayEquals(service.generatePng("stable", 240), service.generatePng("stable", 240));
    }

    @Test
    void generatePng_rejectsEmptyContent() {
        // ZXing refuse d'encoder une chaîne vide : l'appelant doit le voir plutôt
        // que de recevoir une image vide qu'aucun lecteur ne pourra interpréter.
        assertThrows(Exception.class, () -> service.generatePng("", 240));
    }
}
