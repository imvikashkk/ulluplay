-- Ads whose URL is missing ?c=<slug>: map Meta ad id (utm_content) / campaign id (utm_id) → pixel slug.
-- Managed from the admin panel (bakchod_ad → Ad Mapping). Ad mapping wins over campaign mapping.
CREATE TABLE IF NOT EXISTS ad_slug_mappings (
  id            SERIAL PRIMARY KEY,
  match_type    VARCHAR(10)  NOT NULL CHECK (match_type IN ('ad', 'campaign')),
  meta_id       VARCHAR(40)  NOT NULL,
  slug          VARCHAR(50)  NOT NULL REFERENCES pixels(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  campaign_name VARCHAR(200),
  note          TEXT,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (match_type, meta_id)
);

-- Previously hardcoded in CampaignTracker.tsx
INSERT INTO ad_slug_mappings (match_type, meta_id, slug, campaign_name, note) VALUES
  ('ad',       '120248366307600144', 'ullu', 'zenz-cp2', 'URL mein c= nahi hai'),
  ('campaign', '120248347529370144', 'ullu', 'zenz-cp2', 'zenz-cp2 ke bina c= wale ads')
ON CONFLICT (match_type, meta_id) DO NOTHING;
