import type { KeyStatus } from '@/lib/database.types';

/** How each key state is worded and coloured, on the list and on the key's own screen. */
export const KEY_STATUS: Record<KeyStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  active: { label: 'Active', tone: 'success' },
  limited: { label: 'At its limit', tone: 'warning' },
  invalid: { label: 'Rejected', tone: 'danger' },
  disabled: { label: 'Off', tone: 'info' },
};
