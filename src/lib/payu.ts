// Server-only client for PayU India hosted checkout — key/salt come from env and are never exposed to the browser.
// Flow: initiate → /api/payment/payu/checkout (auto-submits a signed form to PayU) → PayU POSTs back to
// /api/payment/payu/callback (surl/furl) → status page. The verify_payment API is the source of truth.
// Docs: https://docs.payu.in/docs/hosted-checkout-merchant-integration , https://docs.payu.in/reference/verify_payment_api
import crypto from 'crypto';
import { isTestEnv } from './appEnv';
import type { GatewayOrderStatus } from './gateway';

const URLS = {
  test: { pay: 'https://test.payu.in/_payment', api: 'https://test.payu.in/merchant/postservice.php?form=2' },
  production: { pay: 'https://secure.payu.in/_payment', api: 'https://info.payu.in/merchant/postservice.php?form=2' },
};

const cfg = () => ({
  ...(isTestEnv ? URLS.test : URLS.production),
  key: (process.env.PAYU_KEY ?? '').trim(),
  salt: (process.env.PAYU_SALT ?? '').trim(),
});

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const sha512 = (s: string) => crypto.createHash('sha512').update(s).digest('hex');

// PayU caps txnid at 25 chars — same KS/KT format as SabPaisa orders so reports and logs read the same
function newTxnId(userId: number): string {
  const prefix = isTestEnv ? 'KT' : 'KS';
  const id = `${prefix}${userId}T${Date.now()}${crypto.randomInt(100, 999)}`;
  return id.length <= 25 ? id : `${prefix}${userId}T${Date.now().toString(36)}${crypto.randomInt(100, 999)}`;
}

export interface PayuOrder {
  orderId: string;
  paymentId: string;
  amount: number;
  // Our own page that posts the signed form to PayU — the browser is sent here
  redirectUrl: string;
  expiresAt: string;
}

export async function createPayuOrder(
  amount: number,
  customer: { userId: number; mobile: string },
): Promise<PayuOrder | { error: string }> {
  const c = cfg();
  if (!c.key || !c.salt) {
    console.error('PayU env missing (PAYU_KEY / PAYU_SALT)');
    return { error: 'Payment init failed' };
  }
  const orderId = newTxnId(customer.userId);
  return {
    orderId,
    paymentId: '',
    amount,
    redirectUrl: `${appUrl()}/api/payment/payu/checkout?txnId=${encodeURIComponent(orderId)}`,
    // Same 30-min window as SabPaisa — the watcher gives up on the order a little after this
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

// Fields for the form the browser POSTs to PayU. Hash:
// sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
export function buildPayuForm(o: { txnId: string; amount: number; productInfo: string; userId: number; mobile: string }) {
  const c = cfg();
  const amount = Number(o.amount).toFixed(2);
  const productinfo = o.productInfo.replace(/[^A-Za-z0-9 ._-]/g, '').trim().slice(0, 100) || 'Subscription';
  const firstname = 'User';
  const mobile = o.mobile.replace(/\D/g, '').slice(-10);
  let host = 'example.com';
  try { host = new URL(appUrl()).hostname || host; } catch { /* keep fallback */ }
  // Users only sign up with a mobile number — derive the email PayU requires
  const email = `${mobile || o.userId}@${host}`;
  const udf1 = String(o.userId);
  const hash = sha512([c.key, o.txnId, amount, productinfo, firstname, email, udf1, '', '', '', '', '', '', '', '', '', c.salt].join('|'));
  const callback = `${appUrl()}/api/payment/payu/callback`;
  return {
    action: c.pay,
    fields: {
      key: c.key, txnid: o.txnId, amount, productinfo, firstname, email, phone: mobile, udf1,
      surl: callback, furl: callback, hash,
    } as Record<string, string>,
  };
}

// Response hash PayU sends to surl/furl:
// sha512([additional_charges|]SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
export function verifyPayuResponseHash(params: URLSearchParams): boolean {
  const { key, salt } = cfg();
  const got = (params.get('hash') ?? '').toLowerCase();
  if (!got || !salt || params.get('key') !== key) return false;
  const p = (k: string) => params.get(k) ?? '';
  const seq = [salt, p('status'), '', '', '', '', '', p('udf5'), p('udf4'), p('udf3'), p('udf2'), p('udf1'),
    p('email'), p('firstname'), p('productinfo'), p('amount'), p('txnid'), key];
  const charges = p('additional_charges') || p('additionalCharges');
  const expected = sha512((charges ? `${charges}|` : '') + seq.join('|'));
  return expected.length === got.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

// verify_payment: status success | failure | pending | Not Found (the user never reached PayU)
export async function getPayuOrderStatus(txnid: string): Promise<GatewayOrderStatus | null> {
  const c = cfg();
  if (!c.key || !c.salt) return null;
  try {
    const res = await fetch(c.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        key: c.key,
        command: 'verify_payment',
        var1: txnid,
        hash: sha512(`${c.key}|verify_payment|${txnid}|${c.salt}`),
      }).toString(),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    const d = data?.transaction_details?.[txnid];
    if (!res.ok || !d) {
      console.error('PayU status failed:', res.status, data?.msg ?? '');
      return null;
    }
    const status = String(d.status ?? '').toLowerCase();
    const amt = parseFloat(d.amt ?? d.transaction_amount);
    return {
      paid: status === 'success',
      failed: status === 'failure',
      status: String(d.unmappedstatus || d.status || '').toUpperCase(),
      gatewayTxnId: d.mihpayid && d.mihpayid !== 'Not Found' ? String(d.mihpayid) : null,
      amount: Number.isFinite(amt) && amt > 0 ? amt : null,
      raw: d,
    };
  } catch (err) {
    console.error('PayU status error:', err);
    return null;
  }
}

// PayU's status on the return POST → the names the status page already understands
export function payuReturnStatus(params: URLSearchParams): string {
  const status = (params.get('status') ?? '').toLowerCase();
  if (status === 'success') return 'SUCCESS';
  if (status === 'failure') return /cancel/i.test(params.get('unmappedstatus') ?? '') ? 'CANCELLED' : 'FAILED';
  return status ? 'PENDING' : '';
}
