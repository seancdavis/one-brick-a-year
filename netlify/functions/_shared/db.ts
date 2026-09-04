// The database connection every function in this directory shares.
// getDatabase() reads its connection string from the platform-provided
// environment (Netlify injects it at runtime); a deploy preview gets its
// own database branch automatically, so preview traffic never touches
// production data.

import { getDatabase } from '@netlify/database';

export const db = getDatabase();
