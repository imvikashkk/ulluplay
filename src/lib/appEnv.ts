// Single switch for the whole app: APP_ENV=test | production (server-only, read at boot/build).
// test       → SabPaisa staging, "TEST MODE" banner, noindex, relaxed checks
// production → SabPaisa live, strict config checks on boot
// Falls back to the old SABPAISA_ENV=staging flag so existing .env files keep working.
import { activeGateway, GATEWAYS, type Gateway } from './gateway';

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
  'MERAOTP_API_KEY',
];

// Keys of the gateway new orders go to (PAYMENT_GATEWAY)
const GATEWAY_REQUIRED: Record<Gateway, string[]> = {
  sabpaisa: ['SABPAISA_CLIENT_CODE', 'SABPAISA_API_KEY', 'SABPAISA_SECRET_KEY'],
  payu: ['PAYU_KEY', 'PAYU_SALT'],
  paytm: ['PAYTM_MID', 'PAYTM_MERCHANT_KEY'],
};

// Returns problems with the current config — production refuses to boot on any of them
export function checkAppConfig(): string[] {
  const problems = [...REQUIRED, ...GATEWAY_REQUIRED[activeGateway()]]
    .filter((k) => !process.env[k])
    .map((k) => `${k} is not set`);
  const gw = (process.env.PAYMENT_GATEWAY ?? '').trim().toLowerCase();
  if (gw && !(GATEWAYS as readonly string[]).includes(gw)) {
    problems.push(`PAYMENT_GATEWAY=${gw} is not one of: ${GATEWAYS.join(', ')}`);
  }

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
