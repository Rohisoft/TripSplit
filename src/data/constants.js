export const COLORS = {
  primary:      '#0D9488',
  primaryLight: '#CCFBF1',
  danger:       '#DC2626',
  dangerLight:  '#FEE2E2',
  warning:      '#D97706',
  warningLight: '#FEF3E2',
  text:         '#111827',
  textMuted:    '#6B7280',
  border:       '#E5E7EB',
  bg:           '#F9FAFB',
  white:        '#FFFFFF',
};

export const CATEGORIES = [
  { id: 'general',    label: 'General',    icon: '🧾' },
  { id: 'food',        label: 'Food',        icon: '🍔' },
  { id: 'transport',   label: 'Transport',   icon: '🚕' },
  { id: 'lodging',     label: 'Lodging',     icon: '🏨' },
  { id: 'activities',  label: 'Activities',  icon: '🎟️' },
  { id: 'shopping',    label: 'Shopping',    icon: '🛍️' },
  { id: 'other',       label: 'Other',       icon: '📦' },
];

export const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'INR', symbol: '₹' },
  { code: 'JPY', symbol: '¥' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
];

export const AVATAR_EMOJIS = ['🙂', '😎', '🧑', '👩', '👨', '🧔', '👱', '🧑‍🦱', '🐶', '🐱', '🦊', '🐼'];

export const TRIP_EMOJIS = ['✈️', '🏖️', '🏔️', '🚗', '🚂', '⛺', '🏝️', '🗽', '🎡', '🍜'];

export function currencySymbol(code) {
  return CURRENCIES.find(c => c.code === code)?.symbol || code;
}

export function categoryIcon(id) {
  return CATEGORIES.find(c => c.id === id)?.icon || '🧾';
}
