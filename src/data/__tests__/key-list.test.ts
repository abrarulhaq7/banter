import { keyModelLabel, keyModels, modelsFor, moveInOrder, nextSortOrder, restingUntil, usableKeys } from '@/data';
import { makeKey, makeModels } from '@/test-utils';

describe('moveInOrder', () => {
  const ids = ['a', 'b', 'c'];

  it('moves a key up or down by one place', () => {
    expect(moveInOrder(ids, 'b', 'up')).toEqual(['b', 'a', 'c']);
    expect(moveInOrder(ids, 'b', 'down')).toEqual(['a', 'c', 'b']);
  });

  it('leaves the order alone at the ends, and for an unknown key', () => {
    expect(moveInOrder(ids, 'a', 'up')).toBe(ids);
    expect(moveInOrder(ids, 'c', 'down')).toBe(ids);
    expect(moveInOrder(ids, 'zzz', 'up')).toBe(ids);
  });

  it('does not change the list it was given', () => {
    moveInOrder(ids, 'b', 'up');
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

describe('nextSortOrder', () => {
  it('starts at 0 and then goes after the last key', () => {
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder([makeKey({ sort_order: 0 }), makeKey({ sort_order: 4 })])).toBe(5);
  });
});

describe('models', () => {
  const models = makeModels();

  it('lists only the chosen provider\'s models, best first', () => {
    expect(modelsFor(models, 'claude').map((model) => model.model_id)).toEqual([
      'claude-sonnet-5-5',
      'claude-haiku-5-5',
    ]);
  });

  it('puts a model without a rank last', () => {
    const unranked = { ...models[0], model_id: 'claude-new', rank: null, sort_order: 0 };
    expect(modelsFor([unranked, ...models], 'claude').map((model) => model.model_id)).toEqual([
      'claude-sonnet-5-5',
      'claude-haiku-5-5',
      'claude-new',
    ]);
  });

  it('gives a key its one chosen model, or all of its provider\'s when it is automatic', () => {
    const own = makeKey({ provider: 'claude', model: 'claude-haiku-5-5' });
    const automatic = makeKey({ provider: 'claude', model: null });
    const removedModel = makeKey({ provider: 'claude', model: 'claude-retired' });

    expect(keyModels(own, models).map((model) => model.model_id)).toEqual(['claude-haiku-5-5']);
    expect(keyModels(automatic, models).map((model) => model.model_id)).toEqual([
      'claude-sonnet-5-5',
      'claude-haiku-5-5',
    ]);
    expect(keyModels(removedModel, models)).toHaveLength(2);

    expect(keyModelLabel(own, models)).toBe('Claude Haiku 5.5');
    expect(keyModelLabel(automatic, models)).toBe('Automatic');
    expect(keyModelLabel(removedModel, models)).toBe('Automatic');
  });

  it('knows until when a model of a key is resting after a limit', () => {
    const now = new Date('2026-11-26T12:00:00Z').getTime();
    const key = makeKey({
      model_limits: { resting: '2026-11-26T12:30:00Z', over: '2026-11-26T11:59:00Z', broken: 'not a time' },
    });

    expect(restingUntil(key, 'resting', now)).toBe(new Date('2026-11-26T12:30:00Z').getTime());
    expect(restingUntil(key, 'over', now)).toBeNull();
    expect(restingUntil(key, 'broken', now)).toBeNull();
    expect(restingUntil(key, 'never-limited', now)).toBeNull();
    expect(restingUntil(makeKey({ model_limits: undefined }), 'any', now)).toBeNull();
  });
});

describe('usableKeys', () => {
  it('keeps only active keys, in order', () => {
    const keys = [
      makeKey({ id: 'a', status: 'active' }),
      makeKey({ id: 'b', status: 'limited' }),
      makeKey({ id: 'c', status: 'disabled' }),
      makeKey({ id: 'd', status: 'invalid' }),
      makeKey({ id: 'e', status: 'active' }),
    ];
    expect(usableKeys(keys).map((key) => key.id)).toEqual(['a', 'e']);
  });
});
