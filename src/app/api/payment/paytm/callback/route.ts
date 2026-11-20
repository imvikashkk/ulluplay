import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { settleOrder } from '@/lib/paymentWatcher';
import { paytmReturnStatus, verifyPaytmCallback } from '@/lib/paytm';

// Paytm callbackUrl: a form POST with ORDERID, MID, TXNID, TXNAMOUNT, STATUS, RESPCODE, RESPMSG, CHECKSUMHASH …
// Like the other callbacks, the POST only tells us which order — settleOrder re-checks it with /v3/order/status,
// then the browser lands on the status page, which polls /api/payment/verify.
async function handle(req: NextRequest, params: URLSearchParams) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/+$/, '');
  const txnId = params.get('ORDERID') ?? '';
  if (!txnId) return NextResponse.redirect(`${appUrl}/subscription`, 303);
  const returned = paytmReturnStatus(params);

  try {
    const payRes = await pool.query(`SELECT txn_id, amount, status FROM payments WHERE txn_id = $1`, [txnId]);
    const pay = payRes.rows[0];
    if (!pay) {
      console.error('payment callback: unknown txn', txnId);
      return NextResponse.redirect(`${appUrl}/subscription`, 303);
    }

    const checksumOk = verifyPaytmCallback(params);
    if (!checksumOk) console.error('payment callback: Paytm checksum mismatch', txnId);

    if (pay.status === 'pending' && (returned === 'FAILED' || returned === 'CANCELLED') && checksumOk) {
      // Failed / cancelled on Paytm's page — close the order now instead of waiting for the watcher
      const saved = Object.fromEntries([...params].filter(([k]) => k !== 'CHECKSUMHASH'));
      await pool.query(
        `UPDATE payments SET status='failed', gateway_response=$1, updated_at=NOW() WHERE txn_id=$2 AND status='pending'`,
        [JSON.stringify({ ...saved, gateway: 'paytm' }), txnId],
      );
      console.log(`payment callback: ${txnId} → ${returned.toLowerCase()} on checkout`);
    } else if (pay.status !== 'success') {
      // Never trust the POST for success — the order status API decides
      const { state } = await settleOrder(pay.txn_id, Number(pay.amount), null);
      console.log(`payment callback: ${pay.txn_id} (${returned}) → ${state}`);
    }
  } catch (err) {
    console.error('payment callback error:', err);
  }
  // 303 so the browser follows with a GET
  const dest = new URL(`${appUrl}/payment/status`);
  dest.searchParams.set('txnId', txnId);
  if (returned) dest.searchParams.set('status', returned);
  return NextResponse.redirect(dest, 303);
}

export async function POST(req: NextRequest) {
  const params = new URLSearchParams(await req.text());
  for (const [k, v] of req.nextUrl.searchParams) if (!params.has(k)) params.set(k, v);
  return handle(req, params);
}

export async function GET(req: NextRequest) {
  return handle(req, req.nextUrl.searchParams);
}
