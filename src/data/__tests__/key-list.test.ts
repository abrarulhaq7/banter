import { defaultModelFor, effectiveModel, modelsFor, moveInOrder, nextSortOrder, usableKeys } from '@/data';
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

  it('lists only the chosen provider\'s models', () => {
    expect(modelsFor(models, 'claude').map((model) => model.model_id)).toEqual([
      'claude-haiku-5-5',
      'claude-sonnet-5-5',
    ]);
  });

  it('finds the provider default', () => {
    expect(defaultModelFor(models, 'claude')?.model_id).toBe('claude-haiku-5-5');
    expect(defaultModelFor([], 'claude')).toBeUndefined();
  });

  it('uses the key\'s own model when it has one, otherwise the default', () => {
    const own = makeKey({ provider: 'claude', model: 'claude-sonnet-5-5' });
    const usesDefault = makeKey({ provider: 'claude', model: null });
    const removedModel = makeKey({ provider: 'claude', model: 'claude-retired' });

    expect(effectiveModel(own, models)?.model_id).toBe('claude-sonnet-5-5');
    expect(effectiveModel(usesDefault, models)?.model_id).toBe('claude-haiku-5-5');
    expect(effectiveModel(removedModel, models)?.model_id).toBe('claude-haiku-5-5');
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
