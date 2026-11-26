import { useEffect, useState } from 'react';

import { dataErrorMessage } from '@/data';
import { groupShots, useHistory, type Shot } from '@/history';

export type PersonHistory =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; shots: Shot[] };

/**
 * What is saved for one person, grouped by screenshot, with a link to each stored
 * screenshot. `reload` is for "Try again".
 */
export function usePersonHistory(personId: string) {
  const history = useHistory();
  const [state, setState] = useState<PersonHistory>({ status: 'loading' });
  const [screenshots, setScreenshots] = useState<Record<string, string>>({});

  const load = async (isCurrent: () => boolean = () => true) => {
    try {
      const shots = groupShots(await history.listInteractions(personId));
      if (!isCurrent()) return;
      setState({ status: 'ready', shots });

      const paths = shots.map((shot) => shot.screenshotPath).filter((path): path is string => !!path);
      const links = await Promise.all(paths.map(async (path) => [path, await history.screenshotUrl(path)] as const));
      if (!isCurrent()) return;
      setScreenshots(Object.fromEntries(links.filter((link): link is readonly [string, string] => !!link[1])));
    } catch (error) {
      if (isCurrent()) setState({ status: 'error', message: dataErrorMessage(error, 'load this history') });
    }
  };

  useEffect(() => {
    let current = true;
    void (async () => {
      await load(() => current);
    })();
    return () => {
      current = false;
    };
    // Loads once for this person.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  return {
    state,
    screenshots,
    reload: () => {
      setState({ status: 'loading' });
      void load();
    },
  };
}
