// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const COLOUR_MESSAGE =
  'Do not write colour values here. Read them from useTheme() so all three themes work (see src/theme/themes.ts).';

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*', '.expo/*', 'reference/*', 'samples/*'],
  },
  {
    // Colours live only in src/theme. Tests may name colours to check them.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**', 'src/**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message: COLOUR_MESSAGE,
        },
        {
          selector: 'Literal[value=/^(rgb|rgba|hsl|hsla)\\(/]',
          message: COLOUR_MESSAGE,
        },
      ],
    },
  },
]);
