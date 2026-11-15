import pool from './db';

export interface ResolvedPixel {
  pixelId: string | null;
  slug: string | null;
  campaignName: string | null;
  via: 'slug' | 'ad' | 'adset' | 'campaign' | 'history' | 'default' | null;
}

const NONE: ResolvedPixel = { pixelId: null, slug: null, campaignName: null, via: null };
const isMetaId = (v: string | null | undefined): v is string => !!v && /^\d{5,30}$/.test(v);

/**
 * Which pixel a visitor belongs to:
 *  1. ?c=<slug> from the ad URL
 *  2. admin "Ad Mapping" by Meta ad id (utm_content)
 *  3. admin "Ad Mapping" by Meta adset id (utm_term)
 *  4. admin "Ad Mapping" by Meta campaign id (utm_id)
 *  5. the slug this campaign id used most in past leads / payments
 *  6. the default pixel
 * 2–6 only run for Meta ad clicks whose URL is missing ?c=.
 */
export async function resolvePixelFor({ slug, adId, adsetId, campaignId }: {
  slug?: string | null; adId?: string | null; adsetId?: string | null; campaignId?: string | null;
}): Promise<ResolvedPixel> {
  if (slug) {
    const r = await pool.query(`SELECT slug, pixel_id FROM pixels WHERE slug = $1`, [slug]);
    return r.rows[0] ? { pixelId: r.rows[0].pixel_id, slug: r.rows[0].slug, campaignName: null, via: 'slug' } : NONE;
  }
  const ad  = isMetaId(adId) ? adId : null;
  const adset = isMetaId(adsetId) ? adsetId : null;
  const cid = isMetaId(campaignId) ? campaignId : null;
  if (!ad && !adset && !cid) return NONE;

  const r = await pool.query(
    `SELECT slug, pixel_id, campaign_name, via FROM (
       SELECT px.slug, px.pixel_id, m.campaign_name, 'ad' AS via, 1 AS prio
         FROM ad_slug_mappings m JOIN pixels px ON px.slug = m.slug
        WHERE m.is_active AND m.match_type = 'ad' AND m.meta_id = $1
       UNION ALL
       SELECT px.slug, px.pixel_id, m.campaign_name, 'adset', 2
         FROM ad_slug_mappings m JOIN pixels px ON px.slug = m.slug
        WHERE m.is_active AND m.match_type = 'adset' AND m.meta_id = $3
       UNION ALL
       SELECT px.slug, px.pixel_id, m.campaign_name, 'campaign', 3
         FROM ad_slug_mappings m JOIN pixels px ON px.slug = m.slug
        WHERE m.is_active AND m.match_type = 'campaign' AND m.meta_id = $2
       UNION ALL
       (SELECT px.slug, px.pixel_id, NULL, 'history', 4
          FROM (SELECT campaign_slug FROM payments           WHERE meta_campaign_id = $2 AND campaign_slug IS NOT NULL
                UNION ALL
                SELECT campaign_slug FROM phone_attributions WHERE meta_campaign_id = $2 AND campaign_slug IS NOT NULL) s
          JOIN pixels px ON px.slug = s.campaign_slug
         GROUP BY px.slug, px.pixel_id ORDER BY COUNT(*) DESC LIMIT 1)
       UNION ALL
       (SELECT slug, pixel_id, NULL, 'default', 5 FROM pixels WHERE is_default LIMIT 1)
     ) x ORDER BY prio LIMIT 1`,
    [ad, cid, adset],
  );
  const row = r.rows[0];
  return row ? { pixelId: row.pixel_id, slug: row.slug, campaignName: row.campaign_name, via: row.via } : NONE;
}
