import pool from './db';

// Landing page (/auth) A/B test — settings live in app_settings so the admin panel can change them live
export type Variant = 'a' | 'b';

export interface LandingAb {
  enabled: boolean;
  // % of new visitors shown B (0–100)
  splitB: number;
  // Bumped on restart — visits/leads are counted per run
  run: number;
  // Shown to everyone while the test is off
  fallback: Variant;
  startedAt: string | null;
}

const DEFAULT: LandingAb = { enabled: false, splitB: 50, run: 1, fallback: 'a', startedAt: null };

// Visitor's variant for a run: `${run}.${variant}`
export const LP_COOKIE = 'mr_lp';
export const VISITOR_COOKIE = 'mr_vid';

export const isVariant = (v: unknown): v is Variant => v === 'a' || v === 'b';

export function parseLpCookie(v: string | undefined): { run: number; variant: Variant } | null {
  const m = /^(\d+)\.([ab])$/.exec(v ?? '');
  return m ? { run: Number(m[1]), variant: m[2] as Variant } : null;
}

function normalize(raw: Partial<LandingAb> | null | undefined): LandingAb {
  const r = raw ?? {};
  return {
    enabled: r.enabled === true,
    splitB: Math.min(100, Math.max(0, Math.round(Number(r.splitB ?? DEFAULT.splitB)) || 0)),
    run: Math.max(1, Math.floor(Number(r.run)) || 1),
    fallback: isVariant(r.fallback) ? r.fallback : 'a',
    startedAt: typeof r.startedAt === 'string' ? r.startedAt : null,
  };
}

// /auth is hit on every visit — keep a short in-process cache instead of a DB read per page view
const TTL_MS = 15 * 1000;
let cache: { at: number; cfg: LandingAb } | null = null;

export async function getLandingAb(fresh = false): Promise<LandingAb> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.cfg;
  try {
    const res = await pool.query(`SELECT value FROM app_settings WHERE key = 'landing_ab'`);
    const cfg = normalize(res.rows[0]?.value);
    cache = { at: Date.now(), cfg };
    return cfg;
  } catch (err) {
    // Table missing / DB down — the page must still render, so fall back to the original design
    console.error('landing ab config error:', err);
    return cache?.cfg ?? DEFAULT;
  }
}

export async function saveLandingAb(cfg: LandingAb): Promise<LandingAb> {
  const clean = normalize(cfg);
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('landing_ab', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(clean)],
  );
  cache = { at: Date.now(), cfg: clean };
  return clean;
}
