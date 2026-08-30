import { useEffect, useState } from 'react';
import { initializeDatabase } from '../db';

let dbInitialized = false;

export function useDatabase() {
  const [isReady, setIsReady] = useState(dbInitialized);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (dbInitialized) {
      setIsReady(true);
      return;
    }

    let cancelled = false;
    async function init() {
      try {
        await initializeDatabase();
        dbInitialized = true;
        if (!cancelled) setIsReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return { isReady, error };
}
