import type { IconName } from '@/components/ui';
import type { ShotStatus } from '@/history';
import type { ColorRole } from '@/theme';

/** How the lines written for one screenshot went: the words, icon and colour for it. */
export const SHOT_STATUS: Record<ShotStatus, { label: string; icon: IconName; color: ColorRole }> = {
  replied: { label: 'She replied', icon: 'replied', color: 'success' },
  no_reply: { label: 'No reply', icon: 'waiting', color: 'danger' },
  sent: { label: 'Sent', icon: 'sent', color: 'info' },
  unused: { label: 'Not used', icon: 'copy', color: 'textMuted' },
};
