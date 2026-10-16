import { verifyAdminToken } from '@/lib/adminAuth';
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getLandingAb, isVariant, saveLandingAb } from '@/lib/landingAb';

const unauthorized = () => NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

// Funnel per variant for one run: visitors → leads (entered number) → buyers (paid after that)
async function statsFor(run: number) {
  const [visits, leads, buys] = await Promise.all([
    pool.query(`SELECT variant, COUNT(*)::int AS n FROM landing_visits WHERE run = $1 GROUP BY variant`, [run]),
    pool.query(`SELECT lp_variant AS variant, COUNT(*)::int AS n FROM users WHERE lp_run = $1 GROUP BY lp_variant`, [run]),
    pool.query(
      `SELECT u.lp_variant AS variant, COUNT(DISTINCT u.id)::int AS buyers, COUNT(*)::int AS orders,
              COALESCE(SUM(p.amount), 0)::int AS revenue
       FROM payments p JOIN users u ON u.id = p.user_id
       WHERE u.lp_run = $1 AND p.status = 'success' AND p.created_at >= u.lp_at
       GROUP BY u.lp_variant`,
      [run],
    ),
  ]);
  const pick = (rows: { variant: string }[], v: string) => rows.find((r) => r.variant?.trim() === v);
  return (['a', 'b'] as const).map((v) => {
    const b = pick(buys.rows, v) as { buyers: number; orders: number; revenue: number } | undefined;
    return {
      variant: v,
      visitors: (pick(visits.rows, v) as { n: number } | undefined)?.n ?? 0,
      leads: (pick(leads.rows, v) as { n: number } | undefined)?.n ?? 0,
      buyers: b?.buyers ?? 0,
      orders: b?.orders ?? 0,
      revenue: b?.revenue ?? 0,
    };
  });
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get('mr_admin')?.value)) return unauthorized();
  try {
    const config = await getLandingAb(true);
    return NextResponse.json({ success: true, config, stats: await statsFor(config.run) });
  } catch (err) {
    console.error('admin landing GET error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

// Body: { enabled?, splitB?, fallback? } to change settings, or { action: 'restart' } to start a fresh run
export async function PUT(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get('mr_admin')?.value)) return unauthorized();
  try {
    const body = await req.json();
    const cur = await getLandingAb(true);
    const next = { ...cur };

    if (body.action === 'restart') {
      next.run = cur.run + 1;
      next.startedAt = new Date().toISOString();
    } else {
      if (typeof body.enabled === 'boolean') {
        next.enabled = body.enabled;
        if (body.enabled && !cur.startedAt) next.startedAt = new Date().toISOString();
      }
      if (body.splitB !== undefined) {
        const s = Number(body.splitB);
        if (!Number.isFinite(s) || s < 0 || s > 100) {
          return NextResponse.json({ success: false, message: 'Split 0–100 ke beech hona chahiye' }, { status: 400 });
        }
        next.splitB = Math.round(s);
      }
      if (body.fallback !== undefined) {
        if (!isVariant(body.fallback)) return NextResponse.json({ success: false, message: 'Invalid variant' }, { status: 400 });
        next.fallback = body.fallback;
      }
    }

    const config = await saveLandingAb(next);
    return NextResponse.json({ success: true, config, stats: await statsFor(config.run) });
  } catch (err) {
    console.error('admin landing PUT error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
