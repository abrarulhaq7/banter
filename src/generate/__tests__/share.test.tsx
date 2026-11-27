import { renderHook, waitFor } from '@testing-library/react-native';

import { redirectSystemPath } from '@/app/+native-intent';
import { isShareLink } from '@/generate/share-link';
import { createIncomingScreenshotHook, type IncomingShare } from '@/generate/use-incoming-screenshot';

describe('isShareLink and the redirect', () => {
  it('sends an image shared from another app to Generate, and every other link where it was going', () => {
    expect(isShareLink('banter://expo-sharing?id=1')).toBe(true);
    expect(isShareLink('/expo-sharing')).toBe(true);
    expect(redirectSystemPath({ path: 'banter://expo-sharing?id=1', initial: true })).toBe('/');

    // The development launcher's own link, and ordinary paths, are left alone.
    const devLink = 'exp+banter://?__expo_url=http%3A%2F%2Flocalhost%3A8081';
    expect(isShareLink(devLink)).toBe(false);
    expect(redirectSystemPath({ path: devLink, initial: true })).toBe(devLink);
    expect(redirectSystemPath({ path: '/people', initial: false })).toBe('/people');
    expect(isShareLink('/expo-sharing-not-really')).toBe(false);
  });
});

describe('useIncomingScreenshot', () => {
  async function setup(
    initial: IncomingShare['resolvedSharedPayloads'],
    ready = true,
    open: jest.Mock = jest.fn(async () => {}),
  ) {
    const share = { payloads: initial, clear: jest.fn() };
    const useShare = (): IncomingShare => ({
      resolvedSharedPayloads: share.payloads,
      clearSharedPayloads: share.clear,
    });
    const useIncomingScreenshot = createIncomingScreenshotHook(useShare);
    const hook = await renderHook(({ isReady }: { isReady: boolean }) => useIncomingScreenshot(open, isReady), {
      initialProps: { isReady: ready },
    });
    return { share, open, hook };
  }

  it('opens a shared image once, and clears it', async () => {
    const { share, open, hook } = await setup([{ contentType: 'image', contentUri: 'content://media/1' }]);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('content://media/1');
    await waitFor(() => expect(share.clear).toHaveBeenCalled());

    await hook.rerender({ isReady: true });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('clears the shared copy only after the image has been prepared, which needs that copy', async () => {
    let finish = () => {};
    const open = jest.fn(() => new Promise<void>((done) => (finish = done)));
    const { share } = await setup([{ contentType: 'image', contentUri: 'file:///cache/expo-sharing/1' }], true, open);

    expect(open).toHaveBeenCalled();
    expect(share.clear).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(share.clear).toHaveBeenCalled());
  });

  it('waits while lines are being written, then opens it', async () => {
    const { open, hook } = await setup([{ contentType: 'image', contentUri: 'content://media/2' }], false);
    expect(open).not.toHaveBeenCalled();

    await hook.rerender({ isReady: true });
    expect(open).toHaveBeenCalledWith('content://media/2');
  });

  it('ignores anything that is not an image', async () => {
    const { open } = await setup([
      { contentType: 'text', contentUri: null },
      { contentType: 'video', contentUri: 'content://media/3' },
    ]);
    expect(open).not.toHaveBeenCalled();
  });
});
