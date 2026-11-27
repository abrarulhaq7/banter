import type { ModelRow } from '@/lib/database.types';

/** The option that leaves the choice to Banter: best model first. Saved as a null model. */
export const AUTOMATIC = 'automatic';

export const AUTOMATIC_HELP = 'The best model first. When it hits its limit, Banter moves to the next one.';

/** The choices in a key's model sheet: Automatic, then each model, best first. */
export function modelOptions(providerModels: ModelRow[]) {
  return [
    { value: AUTOMATIC, label: 'Automatic', subtitle: AUTOMATIC_HELP },
    ...providerModels.map((model) => ({ value: model.model_id, label: model.label })),
  ];
}
