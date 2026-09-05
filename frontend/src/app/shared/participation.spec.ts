import {
  certificateLabel, certificateMessage, certificateReady, certificateTone,
  progressLabel, progressTone
} from './participation';

/**
 * Vocabulaire du suivi de participation.
 *
 * <p>Ces fonctions décident de ce que le participant lit sur son tableau de bord
 * à chaque étape du workflow de certificat. Une erreur ici afficherait
 * « disponible » sur un certificat non délivré : c'est le libellé qui fait foi
 * pour l'utilisateur, d'où ces vérifications explicites état par état.</p>
 */
describe('participation — libellés de suivi', () => {

  describe('progression dans la session', () => {
    it('nomme chaque état du parcours', () => {
      expect(progressLabel('NOT_STARTED')).toBe('À venir');
      expect(progressLabel('IN_PROGRESS')).toBe('En cours');
      expect(progressLabel('COMPLETED')).toBe('Terminée');
      expect(progressLabel('CANCELLED')).toBe('Annulée');
    });

    it('associe un ton visuel cohérent', () => {
      expect(progressTone('COMPLETED')).toBe('success');
      expect(progressTone('IN_PROGRESS')).toBe('info');
      expect(progressTone('CANCELLED')).toBe('danger');
    });

    it('retombe sur « à venir » pour une valeur absente ou inconnue', () => {
      expect(progressLabel(null)).toBe('À venir');
      expect(progressLabel(undefined)).toBe('À venir');
      expect(progressLabel('ETAT_INCONNU')).toBe('À venir');
      expect(progressTone('ETAT_INCONNU')).toBe('neutral');
    });
  });

  describe('état du certificat', () => {
    it('couvre les quatre états du workflow', () => {
      expect(certificateLabel('NOT_AVAILABLE')).toBe('Non disponible');
      expect(certificateLabel('IN_PREPARATION')).toBe('En préparation');
      expect(certificateLabel('PENDING_APPROVAL')).toBe('En attente de validation');
      expect(certificateLabel('SENT')).toBe('Disponible au téléchargement');
    });

    it('signale visuellement l’attente d’une décision administrateur', () => {
      expect(certificateTone('PENDING_APPROVAL')).toBe('warn');
      expect(certificateTone('IN_PREPARATION')).toBe('info');
      expect(certificateTone('SENT')).toBe('success');
      expect(certificateTone('NOT_AVAILABLE')).toBe('neutral');
    });

    it('dit au participant où en est son dossier et qui doit agir', () => {
      expect(certificateMessage('IN_PREPARATION')).toContain('en cours de préparation');
      expect(certificateMessage('PENDING_APPROVAL')).toContain('administrateur');
      expect(certificateMessage('SENT')).toContain('disponible');
      expect(certificateMessage('NOT_AVAILABLE')).toContain('fin de la session');
    });

    it('n’ouvre le téléchargement qu’une fois le certificat envoyé', () => {
      expect(certificateReady('SENT')).toBe(true);
      expect(certificateReady('IN_PREPARATION')).toBe(false);
      expect(certificateReady('PENDING_APPROVAL')).toBe(false);
      expect(certificateReady('NOT_AVAILABLE')).toBe(false);
      expect(certificateReady(null)).toBe(false);
    });

    it('reste insensible à la casse', () => {
      expect(certificateLabel('sent')).toBe('Disponible au téléchargement');
      expect(certificateReady('sent')).toBe(true);
    });

    it('traite un état inconnu comme non disponible plutôt que comme délivré', () => {
      // Comportement volontairement conservateur : en cas de valeur inattendue,
      // on n'annonce jamais un certificat comme téléchargeable.
      expect(certificateLabel('BIZARRE')).toBe('Non disponible');
      expect(certificateReady('BIZARRE')).toBe(false);
    });
  });
});
