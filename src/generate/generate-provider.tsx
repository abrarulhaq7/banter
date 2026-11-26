import { createContext, use, type ReactNode } from 'react';

import { useGenerate, type GenerateController, type GenerateDeps } from './use-generate';

const GenerateContext = createContext<GenerateController | null>(null);

type GenerateProviderProps = {
  children: ReactNode;
  /** Tests replace the photo library, the AI call and the clipboard. */
  deps?: Partial<GenerateDeps>;
};

/**
 * Holds the current screenshot and everything made for it. It sits above the Generate
 * and Results screens, so moving between them loses nothing.
 */
export function GenerateProvider({ children, deps }: GenerateProviderProps) {
  const controller = useGenerate(deps);
  return <GenerateContext value={controller}>{children}</GenerateContext>;
}

export function useGenerateSession(): GenerateController {
  const value = use(GenerateContext);
  if (!value) throw new Error('useGenerateSession must be used inside <GenerateProvider>');
  return value;
}
