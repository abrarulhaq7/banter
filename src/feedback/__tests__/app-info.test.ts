import { appInfo, runningUpdate, updateTime, versionLabel, type UpdatesState } from '@/feedback/app-info';

const CREATED = new Date(2026, 10, 27, 14, 5);

/** What expo-updates reports after an update sent over the air was applied. */
const OVER_THE_AIR: UpdatesState = {
  isEnabled: true,
  isEmbeddedLaunch: false,
  updateId: 'update-1',
  createdAt: CREATED,
  channel: 'preview',
  runtimeVersion: 'fingerprint-1',
};

describe('runningUpdate', () => {
  it('names the update sent over the air that the app runs', () => {
    expect(runningUpdate(OVER_THE_AIR)).toEqual({
      id: 'update-1',
      createdAt: CREATED.toISOString(),
      channel: 'preview',
      runtimeVersion: 'fingerprint-1',
    });
  });

  it('is null for the code the app was built with, a development build, or a build without updates', () => {
    expect(runningUpdate({ ...OVER_THE_AIR, isEmbeddedLaunch: true })).toBeNull();
    expect(runningUpdate({ ...OVER_THE_AIR, isEnabled: false })).toBeNull();
    expect(runningUpdate({ ...OVER_THE_AIR, updateId: null })).toBeNull();
    expect(runningUpdate(null)).toBeNull();
  });
});

describe('appInfo', () => {
  it('carries the update with the version and the phone', () => {
    const info = appInfo(OVER_THE_AIR);
    expect(info.update?.id).toBe('update-1');
    expect(typeof info.version).toBe('string');
    expect(appInfo(null).update).toBeNull();
  });
});

describe('versionLabel', () => {
  const app = { version: '0.1.0', platform: 'android', os: '17', device: null, update: null };

  it('is the version alone when the app runs the code it was built with', () => {
    expect(versionLabel(app)).toBe('Banter 0.1.0');
  });

  it('adds when the update sent over the air was published, in the phone’s time', () => {
    const update = runningUpdate(OVER_THE_AIR);
    expect(versionLabel({ ...app, update })).toBe('Banter 0.1.0 · updated 27 Nov, 14:05');
    expect(updateTime({ ...update!, createdAt: null })).toBeNull();
    expect(versionLabel({ ...app, update: { ...update!, createdAt: 'not a date' } })).toBe('Banter 0.1.0 · updated');
  });
});
