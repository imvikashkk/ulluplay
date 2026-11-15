import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAdminToken } from '@/lib/adminAuth';
import { parseMapping } from '@/lib/adMappings';

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
    const { match_type, meta_id, slug, campaign_name, note, is_active } = parsed.v;
    const res = await pool.query(
      `UPDATE ad_slug_mappings
          SET match_type = $1, meta_id = $2, slug = $3, campaign_name = NULLIF($4, ''), note = NULLIF($5, ''),
              is_active = $6, updated_at = NOW()
        WHERE id = $7`,
      [match_type, meta_id, slug, campaign_name, note, is_active, id],
    );
    if (res.rowCount === 0) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === '23505') return NextResponse.json({ success: false, message: 'Ye ID pehle se mapped hai' }, { status: 409 });
    if (code === '23503') return NextResponse.json({ success: false, message: 'Pixel slug nahi mila' }, { status: 400 });
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
