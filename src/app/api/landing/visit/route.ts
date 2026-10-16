import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getLandingAb, isVariant, LP_COOKIE, parseLpCookie, VISITOR_COOKIE } from '@/lib/landingAb';

// Crawlers and link previews would dilute both variants equally — still, keep them out of the numbers
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse/i;

// Called once by /auth when a new visitor is assigned a variant: counts the visit and pins the variant
export async function POST(req: NextRequest) {
  try {
    const { run, variant } = await req.json();
    const cfg = await getLandingAb();
    if (!cfg.enabled || run !== cfg.run || !isVariant(variant)) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const existing = parseLpCookie(req.cookies.get(LP_COOKIE)?.value);
    const visitorId = req.cookies.get(VISITOR_COOKIE)?.value || randomUUID();
    const res = NextResponse.json({ success: true });
    // Already assigned in this run (double submit / second tab) — keep the first variant
    if (existing?.run === cfg.run) return res;

    if (!BOT_UA.test(req.headers.get('user-agent') ?? '')) {
      await pool.query(
        `INSERT INTO landing_visits (run, visitor_id, variant) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [cfg.run, visitorId.slice(0, 40), variant],
      );
    }
    const opts = { path: '/', sameSite: 'lax' as const, httpOnly: true, secure: process.env.NODE_ENV === 'production' };
    res.cookies.set(LP_COOKIE, `${cfg.run}.${variant}`, { ...opts, maxAge: 60 * 60 * 24 * 30 });
    res.cookies.set(VISITOR_COOKIE, visitorId, { ...opts, maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (err) {
    console.error('landing visit error:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
