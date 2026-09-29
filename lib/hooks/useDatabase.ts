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
        const failure = e instanceof Error ? e : new Error(String(e));
        // Logged in every build, not only under `__DEV__`, and here rather than in
        // the screen that renders the failure. The release APK has no crash
        // reporting and that screen carries no detail, so a dev-only log left a
        // device failure with no trace at all — while a log inside the render body
        // would re-fire on every re-render and make render impure.
        console.error('Database initialization failed:', failure);
        if (!cancelled) setError(failure);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return { isReady, error };
}
