import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useTheme, type ColorRole } from '@/theme';

type PlatformNames = Extract<SymbolViewProps['name'], object>;
type IconSource = { ios: NonNullable<PlatformNames['ios']>; android: NonNullable<PlatformNames['android']> };

/**
 * Every icon the app uses, by what it means. iOS draws Apple's symbol and Android
 * Google's, so the same name looks native on both.
 */
const ICONS = {
  // Tabs
  generate: { ios: 'sparkles', android: 'auto_awesome' },
  people: { ios: 'person.2.fill', android: 'group' },
  settings: { ios: 'gearshape.fill', android: 'settings' },
  // Screenshot
  screenshot: { ios: 'camera.viewfinder', android: 'screenshot' },
  gallery: { ios: 'photo.on.rectangle', android: 'photo_library' },
  // Lines
  copy: { ios: 'doc.on.doc', android: 'content_copy' },
  keep: { ios: 'bookmark', android: 'bookmark' },
  kept: { ios: 'bookmark.fill', android: 'bookmark_added' },
  newLines: { ios: 'arrow.clockwise', android: 'refresh' },
  shorter: { ios: 'arrow.down.right.and.arrow.up.left', android: 'compress' },
  bolder: { ios: 'flame', android: 'local_fire_department' },
  tone: { ios: 'slider.horizontal.3', android: 'tune' },
  // How a line went
  replied: { ios: 'bubble.left.fill', android: 'chat' },
  waiting: { ios: 'clock', android: 'schedule' },
  sent: { ios: 'paperplane.fill', android: 'send' },
  // Things
  person: { ios: 'person.crop.circle', android: 'person' },
  key: { ios: 'key.fill', android: 'key' },
  theme: { ios: 'paintpalette.fill', android: 'palette' },
  signOut: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  search: { ios: 'magnifyingglass', android: 'search' },
  data: { ios: 'externaldrive.fill', android: 'storage' },
  usage: { ios: 'chart.bar.fill', android: 'bar_chart' },
  // About you
  age: { ios: 'calendar', android: 'cake' },
  city: { ios: 'mappin.and.ellipse', android: 'location_on' },
  work: { ios: 'briefcase.fill', android: 'work' },
  interests: { ios: 'heart.fill', android: 'favorite' },
  texting: { ios: 'text.bubble.fill', android: 'sms' },
  // Actions
  back: { ios: 'chevron.left', android: 'arrow_back' },
  forward: { ios: 'chevron.right', android: 'chevron_right' },
  close: { ios: 'xmark', android: 'close' },
  edit: { ios: 'pencil', android: 'edit' },
  add: { ios: 'plus', android: 'add' },
  delete: { ios: 'trash', android: 'delete' },
  check: { ios: 'checkmark', android: 'check' },
  dislike: { ios: 'hand.thumbsdown', android: 'thumb_down' },
  disliked: { ios: 'hand.thumbsdown.fill', android: 'thumb_down' },
  shown: { ios: 'eye', android: 'visibility' },
  hidden: { ios: 'eye.slash', android: 'visibility_off' },
  up: { ios: 'chevron.up', android: 'keyboard_arrow_up' },
  down: { ios: 'chevron.down', android: 'keyboard_arrow_down' },
  power: { ios: 'power', android: 'power_settings_new' },
  checkAgain: { ios: 'checkmark.shield', android: 'verified_user' },
  model: { ios: 'cpu', android: 'memory' },
  // Notices
  info: { ios: 'info.circle.fill', android: 'info' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  danger: { ios: 'xmark.octagon.fill', android: 'error' },
  success: { ios: 'checkmark.circle.fill', android: 'check_circle' },
} as const satisfies Record<string, IconSource>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export type IconProps = {
  name: IconName;
  /** Width and height in points. Default 20. */
  size?: number;
  /** Colour role from the active theme. */
  color?: ColorRole;
  testID?: string;
};

/** A decorative icon. Anything tappable gives its own label: see `IconButton` and `Button`. */
export function Icon({ name, size = 20, color = 'text', testID }: IconProps) {
  const { colors } = useTheme();
  const symbol = ICONS[name];
  return (
    <SymbolView
      testID={testID}
      name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
      size={size}
      tintColor={colors[color]}
      resizeMode="scaleAspectFit"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size }}
    />
  );
}
