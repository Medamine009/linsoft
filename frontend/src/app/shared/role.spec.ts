import { primaryRole } from './role';

/**
 * Résolution du rôle effectif.
 *
 * <p>Le realm Keycloak attribue PARTICIPANT à tout le monde via
 * `default-roles-pfe-events`. Sans priorité explicite, un administrateur serait
 * donc traité comme un simple participant et perdrait son espace. C'est la règle
 * la plus structurante du front : elle mérite d'être verrouillée.</p>
 */
describe('primaryRole', () => {

  it('donne la priorité à ADMIN sur les rôles hérités', () => {
    expect(primaryRole(['default-roles-pfe-events', 'PARTICIPANT', 'ADMIN'])).toBe('ADMIN');
  });

  it('donne la priorité à ORGANISATEUR sur PARTICIPANT', () => {
    expect(primaryRole(['PARTICIPANT', 'ORGANISATEUR'])).toBe('ORGANISATEUR');
  });

  it('classe ADMIN au-dessus d’ORGANISATEUR', () => {
    expect(primaryRole(['ORGANISATEUR', 'ADMIN'])).toBe('ADMIN');
  });

  it('reconnaît un participant simple', () => {
    expect(primaryRole(['PARTICIPANT', 'offline_access'])).toBe('PARTICIPANT');
  });

  it('ignore la casse des rôles', () => {
    expect(primaryRole(['admin'])).toBe('ADMIN');
    expect(primaryRole(['organisateur'])).toBe('ORGANISATEUR');
  });

  it('retombe sur USER quand aucun rôle applicatif n’est présent', () => {
    expect(primaryRole(['offline_access', 'uma_authorization'])).toBe('USER');
  });

  it('tolère une liste absente ou vide', () => {
    expect(primaryRole([])).toBe('USER');
    expect(primaryRole(null)).toBe('USER');
    expect(primaryRole(undefined)).toBe('USER');
  });
});
