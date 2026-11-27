import { readSavedTheme, saveTheme } from '@/theme';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => void values.set(key, value)),
    removeItem: jest.fn(async (key: string) => void values.delete(key)),
  };
}

describe('the theme kept on the phone', () => {
  it('is read back after it was saved', async () => {
    const storage = memoryStorage();

    await saveTheme('ember', storage);

    expect(await readSavedTheme(storage)).toBe('ember');
  });

  it('is nothing on a phone that never chose one', async () => {
    expect(await readSavedTheme(memoryStorage())).toBeNull();
  });

  it('ignores a saved value that is not a theme', async () => {
    expect(await readSavedTheme(memoryStorage({ 'banter.theme': 'neonPink' }))).toBeNull();
  });

  it('never fails the app when the phone\'s storage does', async () => {
    const broken = memoryStorage();
    broken.getItem.mockRejectedValue(new Error('keychain locked'));
    broken.setItem.mockRejectedValue(new Error('keychain locked'));

    expect(await readSavedTheme(broken)).toBeNull();
    await expect(saveTheme('deepSea', broken)).resolves.toBeUndefined();
  });
});
