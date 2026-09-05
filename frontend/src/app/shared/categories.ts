/**
 * Catégories de formations / certifications — alignées sur l'offre réelle
 * LINSOFT Learning Center (partenaire Red Hat & AWS).
 * Source unique de vérité : à importer partout (formulaires, filtres, couleurs).
 */
export const CATEGORIES: string[] = [
  'Red Hat',
  'AWS',
  'Microsoft Azure',
  'Kubernetes',
  'Linux Foundation',
  'SUSE',
  'CompTIA',
  'DevOps',
  'Cybersécurité'
];

/** Couleur unie (badges, pastilles, marqueurs carte). */
const SOLID: Record<string, string> = {
  'red hat': '#e30613',
  'aws': '#ff9900',
  'microsoft azure': '#0078d4',
  'kubernetes': '#326ce5',
  'linux foundation': '#1a2b4a',
  'suse': '#30ba78',
  'comptia': '#c8202f',
  'devops': '#6c4bb6',
  'cybersécurité': '#475569'
};

/** Dégradé (en-têtes de cartes, bannières). */
const GRADIENT: Record<string, string> = {
  'red hat': 'linear-gradient(135deg,#e30613,#a30f0a)',
  'aws': 'linear-gradient(135deg,#ff9900,#ec7211)',
  'microsoft azure': 'linear-gradient(135deg,#0078d4,#004e8c)',
  'kubernetes': 'linear-gradient(135deg,#326ce5,#23488f)',
  'linux foundation': 'linear-gradient(135deg,#2a3c5f,#0f1b30)',
  'suse': 'linear-gradient(135deg,#30ba78,#0c5a3c)',
  'comptia': 'linear-gradient(135deg,#c8202f,#8f1721)',
  'devops': 'linear-gradient(135deg,#6c4bb6,#4b2e83)',
  'cybersécurité': 'linear-gradient(135deg,#334155,#1e293b)'
};

export function categoryColor(cat: string): string {
  return SOLID[(cat || '').toLowerCase()] || '#e30613';
}

export function categoryGradient(cat: string): string {
  return GRADIENT[(cat || '').toLowerCase()] || 'linear-gradient(135deg,#e30613,#a30f0a)';
}
