import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ThemePicker } from '@/components/theme-picker';
import { Banner, Screen, ScreenHeader } from '@/components/ui';
import { useProfile } from '@/data';
import type { ThemeName } from '@/theme';

/** Settings > Theme: three previews, tap one to switch. The choice is saved to the profile. */
export function ThemeScreen() {
  const router = useRouter();
  const { save } = useProfile();
  const [problem, setProblem] = useState<string | null>(null);

  const remember = async (name: ThemeName) => {
    setProblem(null);
    const result = await save({ theme: name });
    if (!result.ok) setProblem(result.message);
  };

  return (
    <Screen testID="theme-screen" fill>
      <ScreenHeader title="Theme" subtitle="Tap one to switch the whole app." onBack={() => router.back()} />
      <ThemePicker onPicked={(name) => void remember(name)} />
      {problem ? (
        <Banner testID="theme-not-saved" tone="warning" title="Changed on this phone only">
          {problem}
        </Banner>
      ) : null}
    </Screen>
  );
}
