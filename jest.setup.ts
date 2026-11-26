import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

// Tests have no native safe-area provider. The library's own mock supplies fixed insets.
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);
