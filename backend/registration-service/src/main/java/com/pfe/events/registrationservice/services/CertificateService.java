package com.pfe.events.registrationservice.services;

import com.lowagie.text.*;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfContentByte;
import com.lowagie.text.pdf.PdfWriter;
import com.pfe.events.registrationservice.entities.Registration;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Génère un certificat de participation en PDF (A4 paysage, charte LINSOFT).
 * Utilise OpenPDF — aucune dépendance externe / réseau.
 */
@Service
public class CertificateService {

    private static final Color RED = new Color(0xE3, 0x06, 0x13);
    private static final Color RED_DK = new Color(0xBD, 0x04, 0x10);
    private static final Color DARK = new Color(0x14, 0x14, 0x16);
    private static final Color GREY = new Color(0x6B, 0x6B, 0x72);
    private static final Color SOFT = new Color(0xF3, 0xC9, 0xCC);

    public byte[] generate(Registration reg) {
        Document doc = new Document(PageSize.A4.rotate(), 54, 54, 60, 54);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter writer = PdfWriter.getInstance(doc, out);
            doc.open();

            PdfContentByte cb = writer.getDirectContent();
            PdfContentByte cbUnder = writer.getDirectContentUnder();
            Rectangle page = doc.getPageSize();
            float w = page.getWidth(), h = page.getHeight();
            BaseFont bf = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.CP1252, BaseFont.NOT_EMBEDDED);

            // ── Filigrane géant discret (SOUS le texte, couleur très claire) ──
            cbUnder.beginText();
            cbUnder.setColorFill(new Color(0xFA, 0xEF, 0xF0));
            cbUnder.setFontAndSize(bf, 150);
            cbUnder.showTextAligned(Element.ALIGN_CENTER, "LINSOFT", w / 2, h / 2 - 40, 20);
            cbUnder.endText();

            // ── Double liseré rouge ──
            cb.setColorStroke(RED);
            cb.setLineWidth(3f);
            cb.rectangle(28, 28, w - 56, h - 56);
            cb.stroke();
            cb.setColorStroke(SOFT);
            cb.setLineWidth(0.8f);
            cb.rectangle(38, 38, w - 76, h - 76);
            cb.stroke();

            // ── Ornements de coin ──
            drawCorners(cb, w, h);

            // ── En-tête marque ──
            Paragraph brand = center("LINSOFT LEARNING CENTER", font(Font.HELVETICA, 15, Font.BOLD, RED));
            brand.setSpacingBefore(26);
            doc.add(brand);
            doc.add(center("Centre de formation certifié Red Hat · AWS", font(Font.HELVETICA, 9, Font.NORMAL, GREY)));

            // ── Titre ──
            Paragraph title = center("CERTIFICAT DE PARTICIPATION", font(Font.HELVETICA, 30, Font.BOLD, DARK));
            title.setSpacingBefore(26);
            doc.add(title);
            doc.add(rule());

            doc.add(spacer(16));
            doc.add(center("Ce certificat atteste que", font(Font.HELVETICA, 12, Font.NORMAL, GREY)));

            // ── Nom du participant ──
            Paragraph name = center(safe(reg.getAttendeeName(), "Participant"), font(Font.HELVETICA, 27, Font.BOLD, RED));
            name.setSpacingBefore(8);
            doc.add(name);
            doc.add(underlineName());

            doc.add(spacer(12));
            doc.add(center("a participé avec succès à la formation", font(Font.HELVETICA, 12, Font.NORMAL, GREY)));

            // ── Titre de la formation ──
            Paragraph ev = center("« " + safe(reg.getEventTitle(), "Formation LINSOFT") + " »", font(Font.HELVETICA, 17, Font.BOLD, DARK));
            ev.setSpacingBefore(8);
            doc.add(ev);

            // ── Date + lieu ──
            StringBuilder meta = new StringBuilder();
            if (notBlank(reg.getEventDateStr())) meta.append("Le ").append(reg.getEventDateStr().replace("T", " à "));
            if (notBlank(reg.getEventLocation())) {
                if (meta.length() > 0) meta.append("   ·   ");
                meta.append(reg.getEventLocation());
            }
            if (meta.length() > 0) {
                Paragraph m = center(meta.toString(), font(Font.HELVETICA, 11, Font.NORMAL, GREY));
                m.setSpacingBefore(10);
                doc.add(m);
            }

            // ── Sceau + signatures (positionnement absolu en bas) ──
            drawSeal(cb, bf, w / 2, 150);
            drawSignature(cb, bf, 175, 335, 118, "La Direction", "LINSOFT Learning Center");
            drawSignature(cb, bf, w - 335, w - 175, 118, "Responsable Formation", "Département Formation");

            // ── Pied : référence + date + vérifiabilité ──
            String issued = LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
            absText(cb, bf, "Référence " + shortRef(reg.getId()) + "   ·   Délivré le " + issued
                    + "   ·   Certificat vérifiable sur LINSOFT Learning Center", w / 2, 62, 8.5f, GREY);

            doc.close();
            return out.toByteArray();
        } catch (Exception e) {
            if (doc.isOpen()) doc.close();
            throw new RuntimeException("Échec de génération du certificat : " + e.getMessage(), e);
        }
    }

    // ── Médaillon « certifié » ──
    private void drawSeal(PdfContentByte cb, BaseFont bf, float cx, float cy) {
        cb.setColorStroke(RED);
        cb.setLineWidth(1.8f);
        cb.circle(cx, cy, 40);
        cb.stroke();
        cb.setColorStroke(SOFT);
        cb.setLineWidth(0.9f);
        cb.circle(cx, cy, 33);
        cb.stroke();
        // petits rayons décoratifs
        cb.setColorStroke(RED);
        cb.setLineWidth(1.1f);
        for (int i = 0; i < 24; i++) {
            double a = Math.toRadians(i * 15);
            float x1 = cx + (float) Math.cos(a) * 40, y1 = cy + (float) Math.sin(a) * 40;
            float x2 = cx + (float) Math.cos(a) * 44, y2 = cy + (float) Math.sin(a) * 44;
            cb.moveTo(x1, y1);
            cb.lineTo(x2, y2);
        }
        cb.stroke();
        // coche
        cb.setColorStroke(RED_DK);
        cb.setLineCap(PdfContentByte.LINE_CAP_ROUND);
        cb.setLineWidth(3.4f);
        cb.moveTo(cx - 14, cy + 2);
        cb.lineTo(cx - 4, cy - 10);
        cb.lineTo(cx + 15, cy + 14);
        cb.stroke();
        absText(cb, bf, "CERTIFIÉ", cx, cy - 58, 8.5f, RED);
    }

    private void drawSignature(PdfContentByte cb, BaseFont bf, float x1, float x2, float y, String role, String org) {
        cb.setColorStroke(GREY);
        cb.setLineWidth(0.8f);
        cb.moveTo(x1, y);
        cb.lineTo(x2, y);
        cb.stroke();
        float cx = (x1 + x2) / 2;
        absText(cb, bf, role, cx, y - 14, 10.5f, DARK);
        absText(cb, bf, org, cx, y - 26, 8.5f, GREY);
    }

    private void drawCorners(PdfContentByte cb, float w, float h) {
        cb.setColorStroke(RED);
        cb.setLineWidth(2.2f);
        float m = 46, len = 26;
        // bas-gauche
        cb.moveTo(m, m + len); cb.lineTo(m, m); cb.lineTo(m + len, m);
        // bas-droite
        cb.moveTo(w - m - len, m); cb.lineTo(w - m, m); cb.lineTo(w - m, m + len);
        // haut-gauche
        cb.moveTo(m, h - m - len); cb.lineTo(m, h - m); cb.lineTo(m + len, h - m);
        // haut-droite
        cb.moveTo(w - m - len, h - m); cb.lineTo(w - m, h - m); cb.lineTo(w - m, h - m - len);
        cb.stroke();
    }

    private void absText(PdfContentByte cb, BaseFont bf, String text, float x, float y, float size, Color color) {
        cb.beginText();
        cb.setFontAndSize(bf, size);
        cb.setColorFill(color);
        cb.showTextAligned(Element.ALIGN_CENTER, text, x, y, 0);
        cb.endText();
    }

    // ── helpers ──
    private Font font(int family, float size, int style, Color color) {
        Font f = new Font(family, size, style);
        f.setColor(color);
        return f;
    }

    private Paragraph center(String text, Font font) {
        Paragraph p = new Paragraph(text, font);
        p.setAlignment(Element.ALIGN_CENTER);
        return p;
    }

    private Paragraph spacer(float ht) {
        Paragraph p = new Paragraph(" ");
        p.setSpacingBefore(ht);
        return p;
    }

    private Paragraph rule() {
        Paragraph p = new Paragraph();
        p.setSpacingBefore(6);
        p.add(new Chunk(new com.lowagie.text.pdf.draw.LineSeparator(1.4f, 22, RED, Element.ALIGN_CENTER, -2)));
        return p;
    }

    private Paragraph underlineName() {
        Paragraph p = new Paragraph();
        p.setSpacingBefore(3);
        p.add(new Chunk(new com.lowagie.text.pdf.draw.LineSeparator(0.8f, 32, SOFT, Element.ALIGN_CENTER, -2)));
        return p;
    }

    private String safe(String v, String fallback) { return notBlank(v) ? v : fallback; }
    private boolean notBlank(String s) { return s != null && !s.isBlank(); }
    /**
     * Référence courte imprimée sur le certificat.
     *
     * <p>On prend les DERNIERS caractères de l'identifiant, pas les premiers :
     * les quatre premiers octets d'un ObjectId MongoDB encodent l'horodatage de
     * création, si bien que toutes les inscriptions créées dans la même seconde
     * partagent les huit premiers caractères. Une référence censée désigner un
     * dossier précis était donc identique pour toute une promotion.</p>
     */
    public static String shortRef(String id) {
        if (id == null || id.isBlank()) return "—";
        return id.substring(Math.max(0, id.length() - 8)).toUpperCase();
    }
}
