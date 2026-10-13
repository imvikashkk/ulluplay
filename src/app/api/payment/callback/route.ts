import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { settleOrder } from '@/lib/paymentWatcher';
import { FAILED_STATUSES, verifyReturnSignature } from '@/lib/sabpaisa';

// SabPaisa returnUrl: GET ?transaction_id=&merchant_txn_id=&status=&amount=&paid_amount=&payment_mode=&timestamp=&signature=
// The query only tells us which order — settleOrder re-checks it via the enquiry API, then the browser
// lands on the status page, which polls /api/payment/verify and sets the cookies.
async function handle(req: NextRequest, params: URLSearchParams) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/+$/, '');
  const txnId = params.get('merchant_txn_id') ?? params.get('merchantTxnId') ?? '';
  if (!txnId) return NextResponse.redirect(`${appUrl}/subscription`, 303);
  const returned = (params.get('status') ?? '').toUpperCase();

  try {
    const payRes = await pool.query(`SELECT txn_id, amount, status FROM payments WHERE txn_id = $1`, [txnId]);
    const pay = payRes.rows[0];
    if (!pay) {
      console.error('payment callback: unknown txn', txnId);
      return NextResponse.redirect(`${appUrl}/subscription`, 303);
    }

    // A 'failed' order is re-checked too — the watcher expires unpaid orders after ~35 min,
    // but a late bank confirmation must still activate the subscription
    if (pay.status === 'pending' && FAILED_STATUSES.includes(returned) && verifyReturnSignature(params)) {
      // Cancelled/failed on SabPaisa's page — the enquiry API may not report it yet, so close the order now
      await pool.query(
        `UPDATE payments SET status='failed', gateway_response=$1, updated_at=NOW() WHERE txn_id=$2 AND status='pending'`,
        [JSON.stringify(Object.fromEntries(params)), txnId],
      );
      console.log(`payment callback: ${txnId} → ${returned.toLowerCase()} on checkout`);
    } else if (pay.status !== 'success') {
      const { state } = await settleOrder(pay.txn_id, Number(pay.amount), null);
      console.log(`payment callback: ${pay.txn_id} (${params.get('status') ?? ''}) → ${state}`);
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

export async function GET(req: NextRequest) {
  return handle(req, req.nextUrl.searchParams);
}

// Accept a form POST too in case the return is ever switched to POST
export async function POST(req: NextRequest) {
  const params = new URLSearchParams(await req.text());
  for (const [k, v] of req.nextUrl.searchParams) if (!params.has(k)) params.set(k, v);
  return handle(req, params);
}
