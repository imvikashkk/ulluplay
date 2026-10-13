// Server-only Paytm merchant UPI intent: the browser pays our Paytm Business VPA straight from a UPI app,
// and the order is confirmed through Paytm's legacy transaction status API (MID + ORDERID)
import crypto from 'crypto';
import QRCode from 'qrcode';

// Paytm gives an intent link no expiry — the pay sheet counts down to this and the watcher gives up after it
const EXPIRY_MINUTES = 10;
const STATUS_URL = 'https://securegw.paytm.in/merchant-status/getTxnStatus';

const cfg = () => ({
  mid: process.env.PAYTM_MID ?? '',
  vpa: process.env.PAYTM_UPI_VPA ?? '',
  payeeName: process.env.PAYTM_PAYEE_NAME ?? 'Ullu Play',
  // Merchant category code from the Paytm QR — optional, some UPI apps flag P2M links without it
  mcc: process.env.PAYTM_MCC ?? '',
});

export interface PaytmOrder {
  orderId: string;
  gatewayOrderId?: string;
  amount: number;
  payeeName: string;
  vpa: string;
  upiLink: string;
  qrCode: string;
  expiresAt: string | null;
}

export interface PaytmOrderStatus {
  paid: boolean;
  failed: boolean;
  status: string;
  gatewayTxnId: string | null;
  amount: number | null;
  raw: object;
}

export async function createPaytmOrder(
  amount: number,
  note: string,
  customer: { userId: number; mobile: string },
): Promise<PaytmOrder | { error: string }> {
  const c = cfg();
  if (!c.mid || !c.vpa) {
    console.error('Paytm env missing (PAYTM_MID / PAYTM_UPI_VPA)');
    return { error: 'Payment init failed' };
  }

  // Sent as the link's `tr` — Paytm records it as the ORDERID the status API is queried with
  const txnid = `KS${customer.userId}T${Date.now()}${crypto.randomInt(100, 999)}`;
  const params = new URLSearchParams({
    pa: c.vpa,
    pn: c.payeeName,
    tr: txnid,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note.slice(0, 50),
  });
  if (c.mcc) params.set('mc', c.mcc);
  // UPI apps expect %20, not the `+` URLSearchParams emits for spaces
  const upiLink = `upi://pay?${params.toString().replace(/\+/g, '%20')}`;

  try {
    return {
      orderId: txnid,
      amount,
      payeeName: c.payeeName,
      vpa: c.vpa,
      upiLink,
      // The order's `tr` travels in the QR, so a scanned payment is still matched to this order
      qrCode: await QRCode.toDataURL(upiLink, { width: 480, margin: 1 }),
      expiresAt: new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString(),
    };
  } catch (err) {
    console.error('Paytm order error:', err);
    return { error: 'Payment init failed' };
  }
}

export async function getPaytmOrderStatus(txnid: string): Promise<PaytmOrderStatus | null> {
  const { mid } = cfg();
  if (!mid) return null;
  try {
    const url = `${STATUS_URL}?JsonData=${encodeURIComponent(JSON.stringify({ MID: mid, ORDERID: txnid }))}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.STATUS || (data.ORDERID && data.ORDERID !== txnid)) {
      if (!res.ok) console.error('Paytm status failed:', res.status);
      return null;
    }
    const status = String(data.STATUS).toUpperCase();
    const amount = parseFloat(data.TXNAMOUNT);
    return {
      paid: status === 'TXN_SUCCESS',
      // Paytm answers TXN_FAILURE ("Invalid Order Id") until the user actually pays, and a failed
      // UPI attempt can be retried on the same link — so never close an order here; expiry does that
      failed: false,
      status,
      gatewayTxnId: data.BANKTXNID || data.TXNID || null,
      amount: Number.isFinite(amount) ? amount : null,
      raw: data,
    };
  } catch (err) {
    console.error('Paytm status error:', err);
    return null;
  }
}
