// Single switch for the whole app: APP_ENV=test | production (server-only, read at boot/build).
// test       → SabPaisa staging, "TEST MODE" banner, noindex, relaxed checks
// production → SabPaisa live, strict config checks on boot
// Falls back to the old SABPAISA_ENV=staging flag so existing .env files keep working.
export type AppEnv = 'test' | 'production';

export const APP_ENV: AppEnv =
  process.env.APP_ENV === 'test' || (!process.env.APP_ENV && process.env.SABPAISA_ENV === 'staging')
    ? 'test'
    : 'production';

export const isTestEnv = APP_ENV === 'test';
export const isProdEnv = APP_ENV === 'production';

const REQUIRED = [
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
  'NEXT_PUBLIC_APP_URL',
  'USER_TOKEN_SECRET', 'ADMIN_TOKEN_SECRET', 'MB_AUTH_SECRET',
  'ADMIN_USER', 'ADMIN_PASSWORD',
  'SABPAISA_CLIENT_CODE', 'SABPAISA_API_KEY', 'SABPAISA_SECRET_KEY',
  'MERAOTP_API_KEY',
];

// Returns problems with the current config — production refuses to boot on any of them
export function checkAppConfig(): string[] {
  const problems = REQUIRED.filter((k) => !process.env[k]).map((k) => `${k} is not set`);

  if (isProdEnv) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    if (appUrl && !appUrl.startsWith('https://')) problems.push('NEXT_PUBLIC_APP_URL must be https in production');
    if (process.env.SABPAISA_ENV === 'staging') problems.push('SABPAISA_ENV=staging conflicts with APP_ENV=production');
    for (const k of ['USER_TOKEN_SECRET', 'ADMIN_TOKEN_SECRET', 'MB_AUTH_SECRET']) {
      const v = process.env[k] ?? '';
      if (v && v.length < 32) problems.push(`${k} should be at least 32 characters in production`);
    }
  }
  return problems;
}
