export type AppRole = 'ADMIN' | 'ORGANISATEUR' | 'PARTICIPANT' | 'USER';

/**
 * Rôle EFFECTIF d'un utilisateur, par priorité descendante.
 * Nécessaire car le realm attribue PARTICIPANT à tout le monde (default-roles) :
 * un admin/organisateur ne doit donc PAS être traité comme un participant.
 */
export function primaryRole(roles: string[] | null | undefined): AppRole {
  const r = (roles || []).map(x => (x || '').toUpperCase());
  if (r.includes('ADMIN')) return 'ADMIN';
  if (r.includes('ORGANISATEUR')) return 'ORGANISATEUR';
  if (r.includes('PARTICIPANT')) return 'PARTICIPANT';
  return 'USER';
}
