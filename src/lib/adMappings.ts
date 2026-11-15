// Admin "Ad Mapping": Meta ad / adset / campaign id → pixel slug, for ads whose URL lacks ?c=

export interface MappingInput {
  ad_id?: string; adset_id?: string; campaign_id?: string;
  slug: string; campaign_name?: string; note?: string; is_active?: boolean;
}
export interface MappingValues {
  ad_id: string | null; adset_id: string | null; campaign_id: string | null;
  slug: string; campaign_name: string | null; note: string | null; is_active: boolean;
}

const metaId = (v: unknown) => String(v ?? '').replace(/\s/g, '');

// Shared validation for POST / PUT
export function parseMapping(body: Partial<MappingInput>): { ok: true; v: MappingValues } | { ok: false; message: string } {
  const ad_id = metaId(body.ad_id), adset_id = metaId(body.adset_id), campaign_id = metaId(body.campaign_id);
  const slug = String(body.slug ?? '').trim();
  for (const [label, v] of [['Ad ID', ad_id], ['Adset ID', adset_id], ['Campaign ID', campaign_id]]) {
    if (v && !/^\d{5,30}$/.test(v)) return { ok: false, message: `${label} sirf digits (5–30) hona chahiye` };
  }
  if (!ad_id && !adset_id && !campaign_id) return { ok: false, message: 'Ad ID, Adset ID ya Campaign ID — kam se kam ek daalo' };
  if (!slug) return { ok: false, message: 'Pixel select karo' };
  return {
    ok: true,
    v: {
      ad_id: ad_id || null, adset_id: adset_id || null, campaign_id: campaign_id || null, slug,
      campaign_name: String(body.campaign_name ?? '').trim().slice(0, 200) || null,
      note: String(body.note ?? '').trim().slice(0, 500) || null,
      is_active: body.is_active !== false,
    },
  };
}

// Postgres error → admin-facing message
export function mappingDbError(err: unknown): { message: string; status: number } | null {
  const code = (err as { code?: string }).code;
  if (code === '23505') return { message: 'Yahi Ad / Adset / Campaign ID combination pehle se mapped hai — usi ko edit karo', status: 409 };
  if (code === '23503') return { message: 'Pixel slug nahi mila', status: 400 };
  return null;
}
