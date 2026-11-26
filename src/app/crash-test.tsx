/**
 * Development only: a screen that always crashes, to check that the crash screen appears
 * instead of the app going down. Open it with banter://crash-test.
 */
export default function CrashTestScreen(): never {
  throw new Error('Crash test: this screen always fails.');
}
