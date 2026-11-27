// Image files imported in code resolve to an image source (Metro turns them into assets).
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';

  const source: ImageSourcePropType;
  export default source;
}
