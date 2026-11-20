import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { buildPaytmForm } from '@/lib/paytm';

export const dynamic = 'force-dynamic';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Paytm's hosted payment page takes a form POST with the txnToken initiate got from initiateTransaction.
// The merchant key stays on the server — only mid/orderId/txnToken go to the browser.
export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/+$/, '');
  const txnId = req.nextUrl.searchParams.get('txnId') ?? '';

  const r = txnId
    ? await pool.query(
        `SELECT txn_id, status, gateway_response->>'gateway' AS gateway, gateway_response->>'txnToken' AS txn_token
         FROM payments WHERE txn_id = $1`,
        [txnId],
      )
    : { rows: [] };
  const pay = r.rows[0];

  // Already settled (Back button / reload) → status page; unknown or not a Paytm order → plans
  if (pay && pay.gateway === 'paytm' && pay.status !== 'pending') {
    return NextResponse.redirect(`${appUrl}/payment/status?txnId=${encodeURIComponent(txnId)}`, 303);
  }
  if (!pay || pay.gateway !== 'paytm' || !pay.txn_token) return NextResponse.redirect(`${appUrl}/subscription`, 303);

  const { action, fields } = buildPaytmForm({ orderId: pay.txn_id, txnToken: pay.txn_token });
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join('');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Redirecting to payment…</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0C0809;color:#F5EFE6;font-family:system-ui,sans-serif}
button{margin-top:16px;padding:12px 20px;border:0;border-radius:8px;background:#FACC15;color:#0C0809;font-weight:800;font-size:15px}</style>
</head><body><form id="f" method="post" action="${esc(action)}" style="text-align:center">${inputs}
<p>Redirecting to secure payment…</p><noscript><button type="submit">Continue to pay</button></noscript></form>
<script>document.getElementById('f').submit()</script></body></html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
