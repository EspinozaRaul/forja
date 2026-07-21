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

    async function init() {
      try {
        await initializeDatabase();
        dbInitialized = true;
        setIsReady(true);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    }

    init();
  }, []);

  return { isReady, error };
}
