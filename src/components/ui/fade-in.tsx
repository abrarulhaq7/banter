import { useEffect, useState, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

export type FadeInProps = {
  children: ReactNode;
  /** Milliseconds to wait first. Give list items rising delays so they arrive one by one. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

const DURATION_MS = 220;
const RISE = 8;

/** Brings its content in with a short fade and a small rise. For things that just arrived. */
export function FadeIn({ children, delay = 0, style }: FadeInProps) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      delay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }) }],
        },
      ]}>
      {children}
    </Animated.View>
  );
}
