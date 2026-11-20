// Server-only client for Paytm Payment Gateway (All-in-One hosted payment page) — merchant key never reaches the browser.
// Flow: initiate → initiateTransaction (server gets a txnToken) → /api/payment/paytm/checkout (auto-submits mid/orderId/txnToken
// to Paytm's showPaymentPage) → Paytm POSTs back to /api/payment/paytm/callback → status page. /v3/order/status is the source of truth.
// Docs: https://www.paytmpayments.com/docs/api/initiate-transaction-api , https://www.paytmpayments.com/docs/api/v3/transaction-status-api
import crypto from 'crypto';
import { isTestEnv } from './appEnv';
import type { GatewayOrderStatus } from './gateway';

// PAYTM_HOST overrides the default (e.g. the older securegw.paytm.in / securegw-stage.paytm.in domains)
const HOSTS = { test: 'https://securestage.paytmpayments.com', production: 'https://secure.paytmpayments.com' };

const cfg = () => ({
  host: ((process.env.PAYTM_HOST ?? '').trim() || (isTestEnv ? HOSTS.test : HOSTS.production)).replace(/\/+$/, ''),
  mid: (process.env.PAYTM_MID ?? '').trim(),
  key: (process.env.PAYTM_MERCHANT_KEY ?? '').trim(),
  website: (process.env.PAYTM_WEBSITE ?? '').trim() || (isTestEnv ? 'WEBSTAGING' : 'DEFAULT'),
});

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

// ── Checksum (same algorithm as Paytm's PaytmChecksum library) ──────────────
// sha256(data|salt) + salt, AES-CBC encrypted with the merchant key and a fixed IV
const IV = '@@@@&&&&####$$$$';
const cipherName = (key: string) => (key.length === 32 ? 'aes-256-cbc' : key.length === 24 ? 'aes-192-cbc' : 'aes-128-cbc');
const hashWithSalt = (data: string, salt: string) =>
  crypto.createHash('sha256').update(`${data}|${salt}`).digest('hex') + salt;

function generateSignature(data: string, key: string): string {
  const salt = crypto.randomBytes(3).toString('base64'); // 4 chars
  const c = crypto.createCipheriv(cipherName(key), key, IV);
  return c.update(hashWithSalt(data, salt), 'binary', 'base64') + c.final('base64');
}

function verifySignature(data: string, key: string, checksum: string): boolean {
  try {
    const d = crypto.createDecipheriv(cipherName(key), key, IV);
    const plain = d.update(checksum, 'base64', 'binary') + d.final('binary');
    const expected = hashWithSalt(data, plain.slice(-4));
    return plain.length === expected.length && crypto.timingSafeEqual(Buffer.from(plain), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Form params → values sorted by key, joined with '|' ("null" counts as empty)
const paramString = (params: Record<string, string>) =>
  Object.keys(params)
    .sort()
    .map((k) => (params[k] && params[k].toLowerCase() !== 'null' ? params[k] : ''))
    .join('|');

// Paytm caps orderId at 50 chars — same KS/KT format as the other gateways so reports and logs read the same
function newOrderId(userId: number): string {
  const prefix = isTestEnv ? 'KT' : 'KS';
  return `${prefix}${userId}T${Date.now()}${crypto.randomInt(100, 999)}`;
}

export interface PaytmOrder {
  orderId: string;
  paymentId: string;
  amount: number;
  // Our own page that posts mid/orderId/txnToken to Paytm — the browser is sent here
  redirectUrl: string;
  expiresAt: string;
  // Short-lived checkout token (not a secret — it is posted from the browser); stored on the order for the checkout page
  txnToken: string;
}

export async function createPaytmOrder(
  amount: number,
  customer: { userId: number; mobile: string },
): Promise<PaytmOrder | { error: string }> {
  const c = cfg();
  if (!c.mid || !c.key) {
    console.error('Paytm env missing (PAYTM_MID / PAYTM_MERCHANT_KEY)');
    return { error: 'Payment init failed' };
  }
  const orderId = newOrderId(customer.userId);
  const mobile = customer.mobile.replace(/\D/g, '').slice(-10);
  const body = JSON.stringify({
    requestType: 'Payment',
    mid: c.mid,
    websiteName: c.website,
    orderId,
    callbackUrl: `${appUrl()}/api/payment/paytm/callback`,
    txnAmount: { value: Number(amount).toFixed(2), currency: 'INR' },
    userInfo: { custId: `CUST${customer.userId}`, ...(mobile ? { mobile } : {}) },
  });

  try {
    // The signature covers the exact body string, so the request is assembled around it
    const res = await fetch(
      `${c.host}/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(c.mid)}&orderId=${encodeURIComponent(orderId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: `{"body":${body},"head":{"signature":"${generateSignature(body, c.key)}"}}`,
        cache: 'no-store',
      },
    );
    const data = await res.json().catch(() => null);
    const info = data?.body?.resultInfo;
    const txnToken: string | undefined = data?.body?.txnToken;
    if (!res.ok || info?.resultStatus !== 'S' || !txnToken) {
      console.error('Paytm initiateTransaction failed:', res.status, info?.resultCode ?? '', info?.resultMsg ?? '');
      return { error: 'Payment init failed' };
    }
    return {
      orderId,
      paymentId: '',
      amount,
      redirectUrl: `${appUrl()}/api/payment/paytm/checkout?txnId=${encodeURIComponent(orderId)}`,
      // Same 30-min window as the other gateways — the watcher gives up on the order a little after this
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      txnToken,
    };
  } catch (err) {
    console.error('Paytm initiateTransaction error:', err);
    return { error: 'Payment init failed' };
  }
}

// Fields for the form the browser POSTs to Paytm's hosted payment page
export function buildPaytmForm(o: { orderId: string; txnToken: string }) {
  const { host, mid } = cfg();
  return {
    action: `${host}/theia/api/v1/showPaymentPage?mid=${encodeURIComponent(mid)}&orderId=${encodeURIComponent(o.orderId)}`,
    fields: { mid, orderId: o.orderId, txnToken: o.txnToken } as Record<string, string>,
  };
}

// CHECKSUMHASH on the callback POST covers every other posted field
export function verifyPaytmCallback(params: URLSearchParams): boolean {
  const { key, mid } = cfg();
  const checksum = params.get('CHECKSUMHASH') ?? '';
  if (!checksum || !key || params.get('MID') !== mid) return false;
  const fields: Record<string, string> = {};
  for (const [k, v] of params) if (k !== 'CHECKSUMHASH') fields[k] = v;
  return verifySignature(paramString(fields), key, checksum);
}

// /v3/order/status: resultStatus TXN_SUCCESS | TXN_FAILURE | PENDING (resultCode 334 = order never reached Paytm)
export async function getPaytmOrderStatus(orderId: string): Promise<GatewayOrderStatus | null> {
  const c = cfg();
  if (!c.mid || !c.key) return null;
  const body = JSON.stringify({ mid: c.mid, orderId });
  try {
    const res = await fetch(`${c.host}/v3/order/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: `{"body":${body},"head":{"signature":"${generateSignature(body, c.key)}"}}`,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    const d = data?.body;
    const info = d?.resultInfo;
    if (!res.ok || !info) {
      console.error('Paytm status failed:', res.status, info?.resultMsg ?? '');
      return null;
    }
    const status = String(info.resultStatus ?? '').toUpperCase();
    const amt = parseFloat(d.txnAmount);
    return {
      paid: status === 'TXN_SUCCESS',
      // 334 = no such order yet (user never reached Paytm) — keep it pending, the watcher expires it
      failed: status === 'TXN_FAILURE' && String(info.resultCode) !== '334',
      status: status === 'TXN_SUCCESS' ? 'SUCCESS' : status === 'TXN_FAILURE' ? 'FAILED' : status || 'PENDING',
      gatewayTxnId: d.txnId ? String(d.txnId) : null,
      amount: Number.isFinite(amt) && amt > 0 ? amt : null,
      raw: d,
    };
  } catch (err) {
    console.error('Paytm status error:', err);
    return null;
  }
}

// Paytm's STATUS on the callback POST → the names the status page already understands
export function paytmReturnStatus(params: URLSearchParams): string {
  const status = (params.get('STATUS') ?? '').toUpperCase();
  if (status === 'TXN_SUCCESS') return 'SUCCESS';
  if (status === 'TXN_FAILURE') {
    const cancelled = params.get('RESPCODE') === '141' || /cancel|not completed/i.test(params.get('RESPMSG') ?? '');
    return cancelled ? 'CANCELLED' : 'FAILED';
  }
  return status ? 'PENDING' : '';
}
