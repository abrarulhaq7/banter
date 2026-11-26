import { Text, type TextProps } from 'react-native';

import { typography, useTheme, type ColorRole, type TypeVariant } from '@/theme';

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  /** Colour role from the active theme. */
  color?: ColorRole;
};

/** All text in the app goes through this, so it always uses the theme's fonts and colours. */
export function AppText({ variant = 'body', color = 'text', style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  return <Text {...rest} style={[typography[variant], { color: colors[color] }, style]} />;
}
