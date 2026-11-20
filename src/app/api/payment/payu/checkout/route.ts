import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { buildPayuForm } from '@/lib/payu';

export const dynamic = 'force-dynamic';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// PayU's hosted checkout takes a form POST, not a redirect — initiate sends the browser here and this page
// posts the signed form. The hash is built server-side from the stored order, so the salt never leaves the server.
export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/+$/, '');
  const txnId = req.nextUrl.searchParams.get('txnId') ?? '';

  const r = txnId
    ? await pool.query(
        `SELECT p.txn_id, p.amount, p.status, p.user_id, p.gateway_response->>'gateway' AS gateway,
                pl.name AS plan_name, u.mobile
         FROM payments p JOIN users u ON u.id = p.user_id LEFT JOIN plans pl ON pl.id = p.plan_id
         WHERE p.txn_id = $1`,
        [txnId],
      )
    : { rows: [] };
  const pay = r.rows[0];

  // Already settled (Back button / reload) → status page; unknown or not a PayU order → plans
  if (pay && pay.gateway === 'payu' && pay.status !== 'pending') {
    return NextResponse.redirect(`${appUrl}/payment/status?txnId=${encodeURIComponent(txnId)}`, 303);
  }
  if (!pay || pay.gateway !== 'payu') return NextResponse.redirect(`${appUrl}/subscription`, 303);

  const { action, fields } = buildPayuForm({
    txnId: pay.txn_id,
    amount: Number(pay.amount),
    productInfo: pay.plan_name ? `Plan ${pay.plan_name}` : 'Subscription',
    userId: Number(pay.user_id),
    mobile: pay.mobile ?? '',
  });
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
