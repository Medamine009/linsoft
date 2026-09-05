import { INavData } from '@coreui/angular';

/**
 * Nav strictement par rôle.
 * /dashboard est l'aiguilleur qui redirige vers la home du rôle.
 */
export const navItems: INavData[] = [

  // ─── PARTICIPANT ───
  {
    title: true,
    name: 'Explorer',
    attributes: { roles: ['PARTICIPANT'] }
  },
  {
    name: 'Espace formation',
    url: '/user',
    iconComponent: { name: 'cil-compass' },
    attributes: { roles: ['PARTICIPANT'] }
  },

  // ─── ORGANISATEUR ───
  {
    title: true,
    name: 'Studio',
    attributes: { roles: ['ORGANISATEUR'] }
  },
  {
    name: 'Mon tableau de bord',
    url: '/organizer',
    iconComponent: { name: 'cil-chart' },
    attributes: { roles: ['ORGANISATEUR'] }
  },
  {
    name: 'Créer un événement',
    url: '/organizer/create',
    iconComponent: { name: 'cil-pencil' },
    attributes: { roles: ['ORGANISATEUR'] }
  },

  // ─── ADMIN · PILOTAGE ───
  {
    title: true,
    name: 'Pilotage',
    attributes: { roles: ['ADMIN'] }
  },
  {
    name: 'Tableau de bord',
    url: '/admin',
    iconComponent: { name: 'cil-chart' },
    attributes: { roles: ['ADMIN'] }
  },
  {
    name: 'Modération & validations',
    url: '/admin',
    linkProps: { queryParams: { tab: 'review' } },
    iconComponent: { name: 'cil-task' },
    attributes: { roles: ['ADMIN'] }
  },
  {
    name: 'Gestion des certificats',
    url: '/admin',
    linkProps: { queryParams: { tab: 'certificates' } },
    iconComponent: { name: 'cil-education' },
    attributes: { roles: ['ADMIN'] }
  },
  {
    name: 'Communication',
    url: '/admin',
    linkProps: { queryParams: { tab: 'communication' } },
    iconComponent: { name: 'cil-envelope-closed' },
    attributes: { roles: ['ADMIN'] }
  },
  {
    name: 'Rapports & statistiques',
    url: '/admin',
    linkProps: { queryParams: { tab: 'stats' } },
    iconComponent: { name: 'cil-chart' },
    attributes: { roles: ['ADMIN'] }
  },

  // ─── ADMIN · GESTION ───
  {
    title: true,
    name: 'Gestion',
    attributes: { roles: ['ADMIN'] }
  },
  {
    // Section à trois types (Formations / Workshops / Conférences) : la sélection
    // vit dans l'URL (?type=…), donc l'entrée reste active quel que soit le type
    // consulté — d'où `activeMatch: 'path'`.
    name: 'Gestion des événements',
    url: '/events',
    linkProps: { queryParams: { type: 'formation' } },
    iconComponent: { name: 'cil-calendar' },
    attributes: { roles: ['ADMIN'], activeMatch: 'path' }
  },
  {
    name: 'Inscriptions',
    url: '/registrations',
    iconComponent: { name: 'cil-task' },
    attributes: { roles: ['ADMIN'] }
  },
  // ─── ADMIN · PERSONNES ───
  {
    title: true,
    name: 'Utilisateurs',
    attributes: { roles: ['ADMIN'] }
  },
  {
    // Section à trois populations (Participants / Formateurs / Administrateurs).
    // Les formateurs ont leur propre page (/formateurs, suivi pédagogique), d'où
    // les deux chemins sur lesquels l'entrée doit rester active.
    name: 'Gestion des utilisateurs',
    url: '/users',
    linkProps: { queryParams: { role: 'participant' } },
    iconComponent: { name: 'cil-people' },
    attributes: { roles: ['ADMIN'], activeMatch: 'path', activePaths: ['/users', '/formateurs'] }
  },

  // Le profil n'est plus dans la nav : on l'ouvre depuis le bloc utilisateur
  // de la barre supérieure.
];
