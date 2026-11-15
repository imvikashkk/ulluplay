import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAdminToken } from '@/lib/adminAuth';
import { parseMapping } from '@/lib/adMappings';

function authCheck(req: NextRequest) {
  return verifyAdminToken(req.cookies.get('mr_admin')?.value);
}

export async function GET(req: NextRequest) {
  if (!authCheck(req)) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const [rows, pixels] = await Promise.all([
      pool.query(
        `SELECT m.id, m.match_type, m.meta_id, m.slug, m.campaign_name, m.note, m.is_active, m.created_at,
                px.label AS pixel_label, px.pixel_id,
                (SELECT COUNT(*)::int FROM payments p
                  WHERE p.campaign_slug = m.slug AND p.status = 'success'
                    AND (CASE m.match_type WHEN 'ad' THEN p.meta_ad_id WHEN 'adset' THEN p.meta_adset_id ELSE p.meta_campaign_id END) = m.meta_id) AS conversions
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
    const { match_type, meta_id, slug, campaign_name, note, is_active } = parsed.v;
    const res = await pool.query(
      `INSERT INTO ad_slug_mappings (match_type, meta_id, slug, campaign_name, note, is_active)
       VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6) RETURNING id`,
      [match_type, meta_id, slug, campaign_name, note, is_active],
    );
    return NextResponse.json({ success: true, id: res.rows[0].id });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === '23505') return NextResponse.json({ success: false, message: 'Ye ID pehle se mapped hai — usi ko edit karo' }, { status: 409 });
    if (code === '23503') return NextResponse.json({ success: false, message: 'Pixel slug nahi mila' }, { status: 400 });
    console.error('ad-mappings POST error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
