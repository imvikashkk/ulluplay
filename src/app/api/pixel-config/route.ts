import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// ?c=<slug>                → that slug's pixel
// ?cid=<meta campaign id>  → fallback for ads whose URL lacks ?c=: reuse the slug this campaign
//                            used before (payments / leads), else the default pixel
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('c');
  const cid  = req.nextUrl.searchParams.get('cid');

  try {
    if (slug) {
      const res = await pool.query(`SELECT pixel_id FROM pixels WHERE slug = $1`, [slug]);
      const pixelId = res.rows[0]?.pixel_id ?? null;
      return NextResponse.json({ pixelId, slug }, {
        headers: { 'Cache-Control': 'public, max-age=60' },
      });
    }

    if (cid && /^\d{5,25}$/.test(cid)) {
      const res = await pool.query(
        `WITH seen AS (
           SELECT campaign_slug FROM payments           WHERE meta_campaign_id = $1 AND campaign_slug IS NOT NULL
           UNION ALL
           SELECT campaign_slug FROM phone_attributions WHERE meta_campaign_id = $1 AND campaign_slug IS NOT NULL
         ), best AS (
           SELECT campaign_slug, COUNT(*) n FROM seen GROUP BY 1 ORDER BY n DESC LIMIT 1
         )
         SELECT slug, pixel_id FROM (
           SELECT px.slug, px.pixel_id, 1 AS prio FROM best JOIN pixels px ON px.slug = best.campaign_slug
           UNION ALL
           (SELECT slug, pixel_id, 2 AS prio FROM pixels WHERE is_default = true LIMIT 1)
         ) x ORDER BY prio LIMIT 1`,
        [cid],
      );
      const row = res.rows[0];
      return NextResponse.json({ pixelId: row?.pixel_id ?? null, slug: row?.slug ?? null }, {
        headers: { 'Cache-Control': 'public, max-age=60' },
      });
    }

    return NextResponse.json({ pixelId: null, slug: null });
  } catch {
    return NextResponse.json({ pixelId: null, slug: null });
  }
}
