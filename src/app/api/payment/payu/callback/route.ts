import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { settleOrder } from '@/lib/paymentWatcher';
import { payuReturnStatus, verifyPayuResponseHash } from '@/lib/payu';

// PayU surl/furl: a form POST with txnid, status, unmappedstatus, mihpayid, amount, udf*, hash …
// Like the SabPaisa callback, the POST only tells us which order — settleOrder re-checks it with the
// verify_payment API, then the browser lands on the status page, which polls /api/payment/verify.
async function handle(req: NextRequest, params: URLSearchParams) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/+$/, '');
  const txnId = params.get('txnid') ?? '';
  if (!txnId) return NextResponse.redirect(`${appUrl}/subscription`, 303);
  const returned = payuReturnStatus(params);

  try {
    const payRes = await pool.query(`SELECT txn_id, amount, status FROM payments WHERE txn_id = $1`, [txnId]);
    const pay = payRes.rows[0];
    if (!pay) {
      console.error('payment callback: unknown txn', txnId);
      return NextResponse.redirect(`${appUrl}/subscription`, 303);
    }

    const hashOk = verifyPayuResponseHash(params);
    if (!hashOk) console.error('payment callback: PayU hash mismatch', txnId);

    if (pay.status === 'pending' && (returned === 'FAILED' || returned === 'CANCELLED') && hashOk) {
      // Failed / cancelled on PayU's page — close the order now instead of waiting for the watcher
      const saved = Object.fromEntries([...params].filter(([k]) => k !== 'hash'));
      await pool.query(
        `UPDATE payments SET status='failed', gateway_response=$1, updated_at=NOW() WHERE txn_id=$2 AND status='pending'`,
        [JSON.stringify({ ...saved, gateway: 'payu' }), txnId],
      );
      console.log(`payment callback: ${txnId} → ${returned.toLowerCase()} on checkout`);
    } else if (pay.status !== 'success') {
      // Never trust the POST for success — the verify_payment API decides
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
