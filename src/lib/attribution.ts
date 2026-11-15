// How a lead / payment got its pixel: ?c= in the URL, an admin Ad Mapping row, campaign history,
// the default pixel, or set by hand. Values come from the browser, so whitelist them.
const VIA = ['url', 'mapping', 'history', 'default', 'manual'] as const;
export type AttributionVia = (typeof VIA)[number];

export function attributionVia(v: unknown): AttributionVia | null {
  return typeof v === 'string' && (VIA as readonly string[]).includes(v) ? (v as AttributionVia) : null;
}

export function mappingIdOf(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}
