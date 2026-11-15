import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAdminToken } from '@/lib/adminAuth';
import { mappingDbError, parseMapping } from '@/lib/adMappings';

function authCheck(req: NextRequest) {
  return verifyAdminToken(req.cookies.get('mr_admin')?.value);
}

export async function GET(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const [rows, pixels] = await Promise.all([
      pool.query(
        `SELECT m.id, m.ad_id, m.adset_id, m.campaign_id, m.slug, m.campaign_name, m.adset_name, m.ad_name, m.note, m.is_active, m.created_at,
                px.label AS pixel_label, px.pixel_id,
                -- conversions on this pixel from the mapping's most specific id
                (SELECT COUNT(*)::int FROM payments p
                  WHERE p.campaign_slug = m.slug AND p.status = 'success'
                    AND CASE WHEN m.ad_id    IS NOT NULL THEN p.meta_ad_id    = m.ad_id
                             WHEN m.adset_id IS NOT NULL THEN p.meta_adset_id = m.adset_id
                             ELSE p.meta_campaign_id = m.campaign_id END) AS conversions,
                -- conversions whose pixel was actually chosen by this mapping row
                (SELECT COUNT(*)::int FROM payments p WHERE p.ad_mapping_id = m.id AND p.status = 'success') AS via_mapping
           FROM ad_slug_mappings m LEFT JOIN pixels px ON px.slug = m.slug
          ORDER BY m.is_active DESC, m.created_at DESC`,
      ),
      pool.query(`SELECT slug, label FROM pixels ORDER BY is_default DESC, created_at DESC`),
    ]);
    return NextResponse.json({ success: true, data: rows.rows, pixels: pixels.rows });
  } catch (err) {
    console.error('ad-mappings GET error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const parsed = parseMapping(await req.json());
    if (!parsed.ok) return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
    const v = parsed.v;
    const res = await pool.query(
      `INSERT INTO ad_slug_mappings (ad_id, adset_id, campaign_id, slug, campaign_name, adset_name, ad_name, note, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [v.ad_id, v.adset_id, v.campaign_id, v.slug, v.campaign_name, v.adset_name, v.ad_name, v.note, v.is_active],
    );
    return NextResponse.json({ success: true, id: res.rows[0].id });
  } catch (err) {
    const known = mappingDbError(err);
    if (known) return NextResponse.json({ success: false, message: known.message }, { status: known.status });
    console.error('ad-mappings POST error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
