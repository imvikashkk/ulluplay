import pool from './db';

export interface ResolvedPixel {
  pixelId: string | null;
  slug: string | null;
  campaignName: string | null;
  adsetName: string | null;
  adName: string | null;
  // From the matched Ad Mapping row — fills ids the ad URL didn't carry
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
  via: 'slug' | 'mapping' | 'history' | 'default' | null;
}

const NONE: ResolvedPixel = { pixelId: null, slug: null, campaignName: null, adsetName: null, adName: null, campaignId: null, adsetId: null, adId: null, via: null };
const isMetaId = (v: string | null | undefined): v is string => !!v && /^\d{5,30}$/.test(v);

/**
 * Which pixel a visitor belongs to:
 *  1. ?c=<slug> from the ad URL
 *  2. admin "Ad Mapping": a row is keyed by its most specific id (ad → adset → campaign);
 *     the most specific matching row wins
 *  3. the slug this campaign id used most in past leads / payments
 *  4. the default pixel
 * 2–4 only run for Meta ad clicks whose URL is missing ?c=.
 */
export async function resolvePixelFor({ slug, adId, adsetId, campaignId }: {
  slug?: string | null; adId?: string | null; adsetId?: string | null; campaignId?: string | null;
}): Promise<ResolvedPixel> {
  if (slug) {
    const r = await pool.query(`SELECT slug, pixel_id FROM pixels WHERE slug = $1`, [slug]);
    return r.rows[0] ? { ...NONE, pixelId: r.rows[0].pixel_id, slug: r.rows[0].slug, via: 'slug' } : NONE;
  }
  const ad    = isMetaId(adId) ? adId : null;
  const adset = isMetaId(adsetId) ? adsetId : null;
  const cid   = isMetaId(campaignId) ? campaignId : null;
  if (!ad && !adset && !cid) return NONE;

  const r = await pool.query(
    `SELECT slug, pixel_id, campaign_name, adset_name, ad_name, campaign_id, adset_id, ad_id, via FROM (
       (SELECT px.slug, px.pixel_id, m.campaign_name, m.adset_name, m.ad_name, m.campaign_id, m.adset_id, m.ad_id, 'mapping' AS via,
               CASE WHEN m.ad_id IS NOT NULL THEN 1 WHEN m.adset_id IS NOT NULL THEN 2 ELSE 3 END AS prio
          FROM ad_slug_mappings m JOIN pixels px ON px.slug = m.slug
         WHERE m.is_active
           AND (   (m.ad_id IS NOT NULL AND m.ad_id = $1)
                OR (m.ad_id IS NULL AND m.adset_id IS NOT NULL AND m.adset_id = $2)
                OR (m.ad_id IS NULL AND m.adset_id IS NULL AND m.campaign_id = $3))
         ORDER BY prio, m.id DESC LIMIT 1)
       UNION ALL
       (SELECT px.slug, px.pixel_id, NULL, NULL, NULL, NULL, NULL, NULL, 'history', 4
          FROM (SELECT campaign_slug FROM payments           WHERE meta_campaign_id = $3 AND campaign_slug IS NOT NULL
                UNION ALL
                SELECT campaign_slug FROM phone_attributions WHERE meta_campaign_id = $3 AND campaign_slug IS NOT NULL) s
          JOIN pixels px ON px.slug = s.campaign_slug
         GROUP BY px.slug, px.pixel_id ORDER BY COUNT(*) DESC LIMIT 1)
       UNION ALL
       (SELECT slug, pixel_id, NULL, NULL, NULL, NULL, NULL, NULL, 'default', 5 FROM pixels WHERE is_default LIMIT 1)
     ) x ORDER BY prio LIMIT 1`,
    [ad, adset, cid],
  );
  const row = r.rows[0];
  return row
    ? { pixelId: row.pixel_id, slug: row.slug, campaignName: row.campaign_name, adsetName: row.adset_name, adName: row.ad_name,
        campaignId: row.campaign_id,
        adsetId: row.adset_id, adId: row.ad_id, via: row.via }
    : NONE;
}
