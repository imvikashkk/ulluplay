import type { NextRequest } from 'next/server';
import pool from './db';
import { activateSubscription } from './activateSubscription';
import { getOrderStatus, orderGateway, type Gateway } from './paymentGateway';

// Runs on the server, so a payment is activated even if the user closed the page or locked the phone
const INTERVAL_MS = 5000;
// Gateway status queries in flight at once
const CONCURRENCY = 10;
// Orders older than this are no longer polled — orders expire well before it
const WINDOW = '1 hour';
// How often each gateway's pending orders are checked, and how long past the order expiry before giving up.
// SabPaisa allows ~100 status checks per payment: fresh orders every 20s, older ones every 2 min.
// Paytm (UPI intent) is checked every tick and closed right at its 10-minute expiry.
const FRESH_MS = 10 * 60 * 1000;
const SCHEDULE: Record<Gateway, { freshGapMs: number; staleGapMs: number; expiryGraceMs: number }> = {
  sabpaisa: { freshGapMs: 20 * 1000, staleGapMs: 2 * 60 * 1000, expiryGraceMs: 5 * 60 * 1000 },
  paytm: { freshGapMs: 0, staleGapMs: 0, expiryGraceMs: 0 },
};
const lastChecked = new Map<string, number>();

export type SettleResult =
  | { state: 'paid'; freshToken: string }
  | { state: 'failed' }
  | { state: 'pending' };

// Shared by verify, callback and the background watcher — the gateway status is the source of truth.
// Pass the order's gateway when known; otherwise it's read from the payment row.
export async function settleOrder(
  txnId: string,
  expectedAmount: number,
  req: NextRequest | null,
  gateway?: Gateway,
): Promise<SettleResult> {
  if (!gateway) {
    const res = await pool.query(`SELECT gateway_response->>'gateway' AS gateway FROM payments WHERE txn_id = $1`, [txnId]);
    gateway = orderGateway(res.rows[0]?.gateway);
  }

  const check = await getOrderStatus(txnId, gateway);
  if (!check) return { state: 'pending' };

  if (check.failed) {
    await pool.query(
      `UPDATE payments SET status='failed', gateway_response=$1, updated_at=NOW()
       WHERE txn_id=$2 AND status='pending'`,
      [JSON.stringify({ ...check.raw, gateway }), txnId],
    );
    return { state: 'failed' };
  }

  if (!check.paid) return { state: 'pending' };

  // Guard against a partial payment being marked as a full plan purchase
  if (check.amount !== null && check.amount + 0.001 < expectedAmount) {
    console.error('Payment amount mismatch:', txnId, check.amount, expectedAmount);
    return { state: 'pending' };
  }

  const result = await activateSubscription(txnId, check.gatewayTxnId, { ...check.raw, gateway }, check.amount ?? expectedAmount, '', '', req);
  return result ? { state: 'paid', freshToken: result.freshToken } : { state: 'pending' };
}

type Row = { txn_id: string; amount: string; created_at: Date; expires_at: string | null; gateway: Gateway };

async function tick() {
  const res = await pool.query(
    `SELECT txn_id, amount, created_at, gateway_response->>'expiresAt' AS expires_at,
            gateway_response->>'gateway' AS gateway
     FROM payments
     WHERE status = 'pending' AND created_at > NOW() - INTERVAL '${WINDOW}'`,
  );
  const rows: Row[] = res.rows.map((r) => ({ ...r, gateway: orderGateway(r.gateway) }));

  const now = Date.now();
  for (const id of lastChecked.keys()) if (!rows.some((r) => r.txn_id === id)) lastChecked.delete(id);
  const due = rows.filter((r) => {
    const s = SCHEDULE[r.gateway];
    const gap = now - new Date(r.created_at).getTime() < FRESH_MS ? s.freshGapMs : s.staleGapMs;
    return now - (lastChecked.get(r.txn_id) ?? 0) >= gap;
  });
  for (const r of due) lastChecked.set(r.txn_id, now);

  // Check orders in parallel batches — one at a time, a backlog of abandoned orders would delay a real payment
  for (let i = 0; i < due.length; i += CONCURRENCY) {
    await Promise.all(due.slice(i, i + CONCURRENCY).map(checkRow));
  }
}

async function checkRow(row: Row) {
  try {
    const { state } = await settleOrder(row.txn_id, Number(row.amount), null, row.gateway);
    if (state !== 'pending') {
      const secs = Math.round((Date.now() - new Date(row.created_at).getTime()) / 1000);
      console.log(`payment watcher: ${row.txn_id} [${row.gateway}] → ${state} (${secs}s after order)`);
      return;
    }

    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : NaN;
    if (!Number.isNaN(expiresAt) && Date.now() > expiresAt + SCHEDULE[row.gateway].expiryGraceMs) {
      await pool.query(
        `UPDATE payments SET status='failed', updated_at=NOW() WHERE txn_id=$1 AND status='pending'`,
        [row.txn_id],
      );
      console.log(`payment watcher: ${row.txn_id} [${row.gateway}] → expired`);
    }
  } catch (err) {
    console.error('payment watcher error:', row.txn_id, err);
  }
}

const g = globalThis as typeof globalThis & { __paymentWatcher?: ReturnType<typeof setInterval> };

// Idempotent — dev hot reload re-runs instrumentation, so keep a single timer per process
export function startPaymentWatcher() {
  if (g.__paymentWatcher) return;
  let running = false;
  g.__paymentWatcher = setInterval(async () => {
    // Skip a tick if the previous one is still waiting on the gateway
    if (running) return;
    running = true;
    try {
      await tick();
    } catch (err) {
      console.error('payment watcher tick error:', err);
    } finally {
      running = false;
    }
  }, INTERVAL_MS);
  console.log('payment watcher started');
}
