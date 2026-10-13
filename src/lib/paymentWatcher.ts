import type { NextRequest } from 'next/server';
import pool from './db';
import { activateSubscription } from './activateSubscription';
import { getSabpaisaOrderStatus } from './sabpaisa';

const INTERVAL_MS = 10000;
// Gateway status queries in flight at once
const CONCURRENCY = 10;
// Orders older than this are no longer polled — orders expire well before it
const WINDOW = '1 hour';
// Still pending this long after the order expiry → give up and mark failed
const EXPIRY_GRACE_MS = 5 * 60 * 1000;
// SabPaisa allows ~100 status checks per payment: fresh orders every 20s, older ones every 2 min
const FRESH_MS = 10 * 60 * 1000;
const FRESH_GAP_MS = 20 * 1000;
const STALE_GAP_MS = 2 * 60 * 1000;
const lastChecked = new Map<string, number>();

export type SettleResult =
  | { state: 'paid'; freshToken: string }
  | { state: 'failed' }
  | { state: 'pending' };

// Shared by verify, callback and the background watcher — the gateway status is the source of truth
export async function settleOrder(
  txnId: string,
  expectedAmount: number,
  req: NextRequest | null,
): Promise<SettleResult> {
  const check = await getSabpaisaOrderStatus(txnId);
  if (!check) return { state: 'pending' };

  if (check.failed) {
    await pool.query(
      `UPDATE payments SET status='failed', gateway_response=$1, updated_at=NOW()
       WHERE txn_id=$2 AND status='pending'`,
      [JSON.stringify(check.raw), txnId],
    );
    return { state: 'failed' };
  }

  if (!check.paid) return { state: 'pending' };

  // Guard against a partial payment being marked as a full plan purchase
  if (check.amount !== null && check.amount + 0.001 < expectedAmount) {
    console.error('Payment amount mismatch:', txnId, check.amount, expectedAmount);
    return { state: 'pending' };
  }

  const result = await activateSubscription(txnId, check.gatewayTxnId, check.raw, check.amount ?? expectedAmount, '', '', req);
  return result ? { state: 'paid', freshToken: result.freshToken } : { state: 'pending' };
}

async function tick() {
  const res = await pool.query(
    `SELECT txn_id, amount, created_at, gateway_response->>'expiresAt' AS expires_at
     FROM payments
     WHERE status = 'pending' AND created_at > NOW() - INTERVAL '${WINDOW}'`,
  );

  const now = Date.now();
  for (const id of lastChecked.keys()) if (!res.rows.some((r) => r.txn_id === id)) lastChecked.delete(id);
  const due = res.rows.filter((r) => {
    const gap = now - new Date(r.created_at).getTime() < FRESH_MS ? FRESH_GAP_MS : STALE_GAP_MS;
    return now - (lastChecked.get(r.txn_id) ?? 0) >= gap;
  });
  for (const r of due) lastChecked.set(r.txn_id, now);

  // Check orders in parallel batches — one at a time, a backlog of abandoned checkouts would delay a real payment
  for (let i = 0; i < due.length; i += CONCURRENCY) {
    await Promise.all(due.slice(i, i + CONCURRENCY).map(checkRow));
  }
}

async function checkRow(row: { txn_id: string; amount: string; created_at: Date; expires_at: string | null }) {
  try {
    const { state } = await settleOrder(row.txn_id, Number(row.amount), null);
    if (state !== 'pending') {
      const secs = Math.round((Date.now() - new Date(row.created_at).getTime()) / 1000);
      console.log(`payment watcher: ${row.txn_id} → ${state} (${secs}s after order)`);
      return;
    }

    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : NaN;
    if (!Number.isNaN(expiresAt) && Date.now() > expiresAt + EXPIRY_GRACE_MS) {
      await pool.query(
        `UPDATE payments SET status='failed', updated_at=NOW() WHERE txn_id=$1 AND status='pending'`,
        [row.txn_id],
      );
      console.log(`payment watcher: ${row.txn_id} → expired`);
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
