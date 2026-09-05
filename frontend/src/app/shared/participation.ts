/**
 * Vocabulaire du suivi de participation et du certificat.
 *
 * Source unique de vérité pour les libellés et les couleurs de statut : l'espace
 * participant et le tableau de bord administrateur regardent le même dossier,
 * ils doivent le nommer de la même façon.
 */

/** Avancement du participant dans la session (calculé par registration-service). */
export type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** État du certificat de participation. */
export type CertificateStatus = 'NOT_AVAILABLE' | 'IN_PREPARATION' | 'PENDING_APPROVAL' | 'SENT';

/** Ton visuel d'un badge — mappé sur les classes CSS `.badge-<tone>`. */
export type StatusTone = 'neutral' | 'info' | 'warn' | 'success' | 'danger';

interface StatusDef {
  label: string;
  tone: StatusTone;
}

const PROGRESS: Record<string, StatusDef> = {
  NOT_STARTED: { label: 'À venir', tone: 'neutral' },
  IN_PROGRESS: { label: 'En cours', tone: 'info' },
  COMPLETED: { label: 'Terminée', tone: 'success' },
  CANCELLED: { label: 'Annulée', tone: 'danger' }
};

const CERTIFICATE: Record<string, StatusDef> = {
  NOT_AVAILABLE: { label: 'Non disponible', tone: 'neutral' },
  IN_PREPARATION: { label: 'En préparation', tone: 'info' },
  PENDING_APPROVAL: { label: 'En attente de validation', tone: 'warn' },
  SENT: { label: 'Disponible au téléchargement', tone: 'success' }
};

/**
 * Ce que le participant lit sur son tableau de bord. Chaque état dit où en est
 * son certificat et qui doit agir — jamais « erreur » ni statut technique.
 */
const CERTIFICATE_MESSAGE: Record<string, string> = {
  NOT_AVAILABLE: "Votre certificat sera préparé automatiquement à la fin de la session.",
  IN_PREPARATION: "Votre certificat est en cours de préparation.",
  PENDING_APPROVAL: "Votre certificat attend la validation de l'administrateur.",
  SENT: 'Votre certificat de participation est disponible.'
};

const key = (s: string | null | undefined, fallback: string): string => {
  const k = (s || '').toUpperCase();
  return k || fallback;
};

export function progressLabel(status: string | null | undefined): string {
  return PROGRESS[key(status, 'NOT_STARTED')]?.label ?? 'À venir';
}

export function progressTone(status: string | null | undefined): StatusTone {
  return PROGRESS[key(status, 'NOT_STARTED')]?.tone ?? 'neutral';
}

export function certificateLabel(status: string | null | undefined): string {
  return CERTIFICATE[key(status, 'NOT_AVAILABLE')]?.label ?? 'Non disponible';
}

export function certificateTone(status: string | null | undefined): StatusTone {
  return CERTIFICATE[key(status, 'NOT_AVAILABLE')]?.tone ?? 'neutral';
}

export function certificateMessage(status: string | null | undefined): string {
  return CERTIFICATE_MESSAGE[key(status, 'NOT_AVAILABLE')] ?? CERTIFICATE_MESSAGE['NOT_AVAILABLE'];
}

/** Le certificat est-il téléchargeable par le participant ? */
export function certificateReady(status: string | null | undefined): boolean {
  return key(status, '') === 'SENT';
}
