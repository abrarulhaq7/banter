import { useRouter } from 'expo-router';

import { ThemePicker } from '@/components/theme-picker';
import { Screen, ScreenHeader } from '@/components/ui';

/** Settings > Theme: three previews, tap one to switch. */
export default function ThemeRoute() {
  const router = useRouter();
  return (
    <Screen testID="theme-screen">
      <ScreenHeader title="Theme" subtitle="Tap one to switch the whole app." onBack={() => router.back()} />
      <ThemePicker />
    </Screen>
  );
}
