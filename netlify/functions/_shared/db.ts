// The database connection every function in this directory shares.
// getDatabase() reads its connection string from the platform-provided
// environment (Netlify injects it at runtime); a deploy preview gets its
// own database branch automatically, so preview traffic never touches
// production data. Function modules do no work at import time, so the
// handle is created lazily here, on first use, and cached for the life of
// the function instance.

import { getDatabase } from '@netlify/database';

let cached: ReturnType<typeof getDatabase> | null = null;

export function getDb(): ReturnType<typeof getDatabase> {
  if (cached === null) {
    cached = getDatabase();
  }
  return cached;
}
