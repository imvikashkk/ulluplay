import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { APP_ENV, checkAppConfig } from '@/lib/appEnv';

export const dynamic = 'force-dynamic';

// Quick check of which mode a server is in — no secrets, only names of missing settings
export async function GET() {
  let db = false;
  try {
    await pool.query('SELECT 1');
    db = true;
  } catch {}
  const problems = checkAppConfig();
  return NextResponse.json(
    {
      env: APP_ENV,
      gateway: APP_ENV === 'test' ? 'sabpaisa-staging' : 'sabpaisa-live',
      db,
      configOk: problems.length === 0,
      problems,
    },
    { status: db ? 200 : 503 },
  );
}
