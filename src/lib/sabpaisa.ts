// Server-only client for the SabPaisa PG 3.0 merchant API — keys come from env and are never exposed to the browser
// Docs: https://devdocs.sabpaisa.in/api-reference
import crypto from 'crypto';

const BASE_URLS = {
  staging: 'https://staging-sb-merchant-api.sabpaisa.in',
  production: 'https://merchant-api.sabpaisa.in',
};

const cfg = () => ({
  baseUrl: process.env.SABPAISA_ENV === 'staging' ? BASE_URLS.staging : BASE_URLS.production,
  clientCode: process.env.SABPAISA_CLIENT_CODE ?? '',
  apiKey: process.env.SABPAISA_API_KEY ?? '',
  secretKey: process.env.SABPAISA_SECRET_KEY ?? '',
});

export interface SabpaisaOrder {
  orderId: string;
  paymentId: string;
  amount: number;
  // checkoutUrl + clientSecret — the browser is sent here
  redirectUrl: string;
  expiresAt: string;
}

export interface SabpaisaOrderStatus {
  paid: boolean;
  failed: boolean;
  status: string;
  gatewayTxnId: string | null;
  amount: number | null;
  raw: object;
}

async function post(path: string, body: object) {
  const c = cfg();
  const res = await fetch(`${c.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': c.apiKey },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return { ok: res.ok, data: await res.json().catch(() => null) };
}

export async function createSabpaisaOrder(
  amount: number,
  customer: { userId: number; mobile: string },
): Promise<SabpaisaOrder | { error: string }> {
  const c = cfg();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  if (!c.clientCode || !c.apiKey || !c.secretKey) {
    console.error('SabPaisa env missing (SABPAISA_CLIENT_CODE / SABPAISA_API_KEY / SABPAISA_SECRET_KEY)');
    return { error: 'Payment init failed' };
  }

  // Doubles as our txn_id — alphanumeric only, unique per attempt
  const txnid = `KS${customer.userId}T${Date.now()}${crypto.randomInt(100, 999)}`;
  const mobile = customer.mobile.replace(/\D/g, '').slice(-10);
  const paise = Math.round(amount * 100);
  const timestamp = Math.floor(Date.now() / 1000);
  const checksum = crypto
    .createHmac('sha256', c.secretKey)
    .update(`${c.clientCode}|${txnid}|${paise}|INR|${timestamp}`)
    .digest('hex');

  try {
    const { ok, data } = await post('/api/v2/payments', {
      merchantId: c.clientCode,
      merchantTxnId: txnid,
      amount: paise,
      currency: 'INR',
      // Users only sign up with a mobile number — derive name/email
      customerName: 'User',
      customerEmail: `${mobile || customer.userId}@kaama.online`,
      customerPhone: mobile,
      returnUrl: `${appUrl}/api/payment/callback`,
      udf1: String(customer.userId),
      checksum,
      timestamp,
    });
    if (!ok || !data?.success || !data.checkoutUrl || !data.clientSecret) {
      console.error('SabPaisa create failed:', data?.error?.code ?? '', data?.error?.message ?? data?.message ?? '', data?.traceId ?? '');
      return { error: 'Payment init failed' };
    }

    const redirect = new URL(String(data.checkoutUrl));
    redirect.searchParams.set('clientSecret', String(data.clientSecret));
    return {
      orderId: txnid,
      paymentId: String(data.paymentId ?? ''),
      amount,
      redirectUrl: redirect.toString(),
      expiresAt: data.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  } catch (err) {
    console.error('SabPaisa create error:', err);
    return { error: 'Payment init failed' };
  }
}

// SabPaisa allows ~100 status checks per payment — callers keep their polling well under that
export async function getSabpaisaOrderStatus(txnid: string): Promise<SabpaisaOrderStatus | null> {
  const c = cfg();
  try {
    const { ok, data } = await post('/api/v2/payments/enquiry', { clientCode: c.clientCode, merchantTxnId: txnid });
    if (!ok || !data?.success || !data.status) return null;
    const status = String(data.status).toUpperCase();
    const paid = parseFloat(data.paidAmount);
    const paise = Number(data.amountPaise);
    return {
      paid: status === 'SUCCESS',
      failed: FAILED_STATUSES.includes(status),
      status,
      gatewayTxnId: data.txnId ?? data.bankRrn ?? null,
      amount: Number.isFinite(paid) && paid > 0 ? paid : Number.isFinite(paise) && paise > 0 ? paise / 100 : null,
      raw: data,
    };
  } catch (err) {
    console.error('SabPaisa status error:', err);
    return null;
  }
}

// Statuses that end a payment without money moving
export const FAILED_STATUSES = ['FAILED', 'EXPIRED', 'TIMEOUT', 'CANCELLED'];

// returnUrl signature: HMAC-SHA256(secret, every other param sorted by key as `key=value` joined by `|`), hex
export function verifyReturnSignature(params: URLSearchParams): boolean {
  const signature = params.get('signature');
  const { secretKey } = cfg();
  if (!signature || !secretKey) return false;
  const data = [...params.entries()]
    .filter(([k]) => k !== 'signature')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('|');
  const expected = crypto.createHmac('sha256', secretKey).update(data).digest('hex');
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()));
}
