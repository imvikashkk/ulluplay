import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAdminToken } from '@/lib/adminAuth';
import { mappingDbError, parseMapping } from '@/lib/adMappings';

function authCheck(req: NextRequest) {
  return verifyAdminToken(req.cookies.get('mr_admin')?.value);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authCheck(req)) return NextResponse.json({ success: false }, { status: 401 });
  const id = parseInt((await params).id);
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });

  try {
    const parsed = parseMapping(await req.json());
    if (!parsed.ok) return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
    const v = parsed.v;
    const res = await pool.query(
      `UPDATE ad_slug_mappings
          SET ad_id = $1, adset_id = $2, campaign_id = $3, slug = $4, campaign_name = $5, adset_name = $6,
              ad_name = $7, note = $8, is_active = $9, updated_at = NOW()
        WHERE id = $10`,
      [v.ad_id, v.adset_id, v.campaign_id, v.slug, v.campaign_name, v.adset_name, v.ad_name, v.note, v.is_active, id],
    );
    if (res.rowCount === 0) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const known = mappingDbError(err);
    if (known) return NextResponse.json({ success: false, message: known.message }, { status: known.status });
    console.error('ad-mappings PUT error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authCheck(req)) return NextResponse.json({ success: false }, { status: 401 });
  const id = parseInt((await params).id);
  if (isNaN(id)) return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });
  try {
    await pool.query(`DELETE FROM ad_slug_mappings WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('ad-mappings DELETE error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
