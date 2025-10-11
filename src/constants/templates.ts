// Template mapping for transaction categories
// Shared constant used across CSV import and merchant rules

export const TEMPLATE_MAP: Record<string, 'market' | 'covenant' | 'chronicle' | 'treasury'> = {
  'grocery': 'market',
  'auto': 'market',
  'rent': 'covenant',
  'bills': 'covenant',
  'investment': 'treasury',
  'supplements': 'market',
  'misc-shop': 'chronicle',
  'misc-health': 'chronicle',
  'home-garden': 'chronicle',
};
