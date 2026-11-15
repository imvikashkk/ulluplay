// Admin "Ad Mapping": Meta ad id / campaign id → pixel slug, for ads whose URL lacks ?c=

export interface MappingInput { match_type: string; meta_id: string; slug: string; campaign_name?: string; note?: string; is_active?: boolean }

// Shared validation for POST / PUT
export function parseMapping(body: Partial<MappingInput>): { ok: true; v: Required<MappingInput> } | { ok: false; message: string } {
  const match_type = ['ad', 'adset', 'campaign'].includes(String(body.match_type)) ? String(body.match_type) : '';
  const meta_id = String(body.meta_id ?? '').trim();
  const slug = String(body.slug ?? '').trim();
  if (!match_type) return { ok: false, message: 'Type must be Ad ID, Adset ID or Campaign ID' };
  if (!/^\d{5,30}$/.test(meta_id)) return { ok: false, message: 'Meta ID sirf digits (5–30) hona chahiye' };
  if (!slug) return { ok: false, message: 'Pixel select karo' };
  return {
    ok: true,
    v: {
      match_type, meta_id, slug,
      campaign_name: String(body.campaign_name ?? '').trim().slice(0, 200),
      note: String(body.note ?? '').trim().slice(0, 500),
      is_active: body.is_active !== false,
    },
  };
}
