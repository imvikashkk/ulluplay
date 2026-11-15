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

// TEMP: Meta ad id → pixel slug, for ads running without ?c= in their URL
const AD_SLUG_MAP: Record<string, { slug: string; campaignName?: string }> = {
  '120248366307600144': { slug: 'ullu', campaignName: 'zenz-cp2' },
};

export default function CampaignTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('c');
    if (slug) {
      localStorage.setItem('mr_campaign', slug);
    }

    const isResolved = (v: string) => !v.includes('{{');
    // TEMP fallback: Meta auto-appends utm_id (= campaign id) to every ad click, even when the ad's URL has no ?c=
    const utmId = params.get('utm_id');
    const fromMetaAd = !!params.get('fbclid') || /^(ig|fb|an|msg|facebook|instagram)$/i.test(params.get('utm_source') ?? '');
    const metaCampaignId   = params.get('meta_campaign_id') || (fromMetaAd && utmId && /^\d+$/.test(utmId) ? utmId : null);
    const adMap = AD_SLUG_MAP[params.get('utm_content') ?? ''];
    const metaCampaignName = params.get('meta_campaign_name') || (fromMetaAd ? adMap?.campaignName ?? null : null);
    if (metaCampaignId   && isResolved(metaCampaignId))   localStorage.setItem('mr_meta_campaign_id',   metaCampaignId);
    if (metaCampaignName && isResolved(metaCampaignName)) localStorage.setItem('mr_meta_campaign_name', metaCampaignName);

    // Save the ad click (fbclid) even without a slug, so CAPI can still match the purchase
    ensureFbCookies(params.get('fbclid'));

    // TEMP: ads whose URL is missing ?c= → pin them to the right pixel by Meta ad id (utm_content)
    const adSlug = adMap?.slug;
    if (!slug && adSlug) localStorage.setItem('mr_campaign', adSlug);

    const campaignSlug = slug || adSlug || localStorage.getItem('mr_campaign') || '';
    const fallbackCid  = !campaignSlug && metaCampaignId && isResolved(metaCampaignId) ? metaCampaignId : '';
    if (!campaignSlug && !fallbackCid) return;

    loadPixelBase();

    const query = campaignSlug ? `c=${encodeURIComponent(campaignSlug)}` : `cid=${encodeURIComponent(fallbackCid)}`;
    fetch(`/api/pixel-config?${query}`)
      .then((r) => r.json())
      .then(({ pixelId, slug: resolved }: { pixelId: string | null; slug?: string | null }) => {
        // Fallback found a slug → store it so the lead + payment get attributed and CAPI fires
        if (!campaignSlug && resolved && !localStorage.getItem('mr_campaign')) localStorage.setItem('mr_campaign', resolved);
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
