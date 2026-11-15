'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    fbq: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: (...args: unknown[]) => void };
    _fbq: unknown;
  }
}

// Meta pixel base code — defines the fbq queue synchronously, so init below never races the script load
function loadPixelBase() {
  if (typeof window.fbq === 'function') return;
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue.push(args);
  } as Window['fbq'];
  window.fbq = n;
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
  const t = document.createElement('script');
  t.async = true;
  t.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(t);
}

function getCookie(name: string) {
  return document.cookie.split('; ').find((r) => r.startsWith(name + '='))?.split('=')[1] ?? '';
}

// Set _fbp/_fbc in Meta's own format when the pixel hasn't (ad blocker, slow script) — CAPI reads them
// server-side to match purchases to the ad click. fbevents.js reuses these cookies if present.
function ensureFbCookies(fbclid: string | null) {
  const opts = `; path=/; max-age=${60 * 60 * 24 * 90}; SameSite=Lax`;
  if (!getCookie('_fbp')) {
    document.cookie = `_fbp=fb.1.${Date.now()}.${Math.floor(Math.random() * 1e10)}${opts}`;
  }
  if (fbclid && !getCookie('_fbc').endsWith(`.${fbclid}`)) {
    document.cookie = `_fbc=fb.1.${Date.now()}.${fbclid}${opts}`;
  }
}

export default function CampaignTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('c');
    if (slug) {
      localStorage.setItem('mr_campaign', slug);
    }

    const isResolved = (v: string) => !v.includes('{{');
    const num = (v: string | null) => (v && /^\d+$/.test(v) ? v : null);

    // Meta auto-appends utm_* to every ad click, even when the ad's own URL has no ?c=:
    // utm_id = campaign id, utm_term = adset id, utm_content = ad id
    const fromMetaAd = !!params.get('fbclid') || /^(ig|fb|an|msg|facebook|instagram)$/i.test(params.get('utm_source') ?? '');
    const utm = (k: string) => (fromMetaAd ? num(params.get(k)) : null);

    const metaCampaignId   = params.get('meta_campaign_id') || utm('utm_id');
    const metaCampaignName = params.get('meta_campaign_name');
    if (metaCampaignId   && isResolved(metaCampaignId))   localStorage.setItem('mr_meta_campaign_id',   metaCampaignId);
    if (metaCampaignName && isResolved(metaCampaignName)) localStorage.setItem('mr_meta_campaign_name', metaCampaignName);
    const ids: Record<string, string | null> = {
      meta_adset_id: params.get('meta_adset_id') || utm('utm_term'),
      meta_adset_name: params.get('meta_adset_name'),
      meta_ad_id: params.get('meta_ad_id') || utm('utm_content'),
      meta_ad_name: params.get('meta_ad_name'),
    };
    for (const [k, v] of Object.entries(ids)) {
      if (v && isResolved(v)) localStorage.setItem(`mr_${k}`, v);
    }

    // Save the ad click (fbclid) even without a slug, so CAPI can still match the purchase
    ensureFbCookies(params.get('fbclid'));

    // No ?c= on a Meta ad click → resolve the pixel from admin "Ad Mapping" (ad id → adset id → campaign id → history)
    const adId  = ids.meta_ad_id && isResolved(ids.meta_ad_id) ? ids.meta_ad_id : '';
    const adsetId = ids.meta_adset_id && isResolved(ids.meta_adset_id) ? ids.meta_adset_id : '';
    const campId = metaCampaignId && isResolved(metaCampaignId) ? metaCampaignId : '';
    const resolveFromAd = !slug && fromMetaAd && !!(adId || adsetId || campId);

    const campaignSlug = slug || localStorage.getItem('mr_campaign') || '';
    if (!campaignSlug && !resolveFromAd) return;

    loadPixelBase();

    const query = resolveFromAd
      ? new URLSearchParams({ ...(adId && { ad: adId }), ...(adsetId && { adset: adsetId }), ...(campId && { cid: campId }) }).toString()
      : `c=${encodeURIComponent(campaignSlug)}`;
    fetch(`/api/pixel-config?${query}`)
      .then((r) => r.json())
      .then((cfg: { pixelId: string | null; slug?: string | null; campaignName?: string | null;
                    campaignId?: string | null; adsetId?: string | null; adId?: string | null }) => {
        const { pixelId } = cfg;
        if (resolveFromAd && cfg.slug) {
          localStorage.setItem('mr_campaign', cfg.slug);
          // Ad Mapping knows which adset / campaign the ad belongs to — fill what the URL didn't carry
          const fill: [string, string | null | undefined, string | null][] = [
            ['mr_meta_campaign_name', cfg.campaignName, metaCampaignName],
            ['mr_meta_campaign_id', cfg.campaignId, campId],
            ['mr_meta_adset_id', cfg.adsetId, adsetId],
            ['mr_meta_ad_id', cfg.adId, adId],
          ];
          for (const [key, val, fromUrl] of fill) if (val && !fromUrl) localStorage.setItem(key, val);
        }
        if (!pixelId) return;
        // Only init once per session — fbq queues events until init, so re-init causes duplicate sends
        const w = window as Window & { __mr_pixel_inited?: string };
        if (w.__mr_pixel_inited === pixelId) return;
        w.__mr_pixel_inited = pixelId;
        window.fbq('init', pixelId);
        window.fbq('track', 'PageView');
      })
      .catch(() => {});
  }, []);

  return null;
}
