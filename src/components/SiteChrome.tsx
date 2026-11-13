import Link from 'next/link';
import type { ReactNode } from 'react';
import { GOLD_GRADIENT, GOLD_LIGHT, INK, LINE, RED, YELLOW } from '@/lib/brand';

// Text-only wordmark: gold-foil KAMA, then a crimson OTT pill (thin gold edge) with a play triangle
export function Logo({ size = 28, adult = true, className = '' }: { size?: number; adult?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center select-none leading-none ${className}`} style={{ gap: size * 0.2 }}>
      <span
        className="k-display k-gold"
        style={{
          fontSize: size * 1.08,
          letterSpacing: '0.06em',
        }}
      >
        KAMA
      </span>
      <span
        className="k-display inline-flex items-center"
        style={{
          fontSize: size * 0.55,
          letterSpacing: '0.16em',
          gap: size * 0.1,
          padding: `${size * 0.13}px ${size * 0.22}px ${size * 0.11}px ${size * 0.16}px`,
          borderRadius: 999,
          color: GOLD_LIGHT,
          background: `linear-gradient(180deg, #E0213F, ${RED} 60%, #8E0B22)`,
          border: `1px solid ${YELLOW}88`,
          boxShadow: `0 ${size * 0.08}px ${size * 0.3}px -${size * 0.1}px ${RED}`,
        }}
      >
        <svg width={size * 0.32} height={size * 0.32} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z" />
        </svg>
        OTT
      </span>
      {adult && (
        <span
          className="text-[9px] font-bold px-1.5 py-px rounded-full"
          style={{ color: YELLOW, border: `1px solid ${YELLOW}99`, background: INK }}
        >
          18+
        </span>
      )}
    </span>
  );
}

// Solid top bar: logo left, page actions right
export function SiteHeader({ right, sticky = true }: { right?: ReactNode; sticky?: boolean }) {
  return (
    <header
      className={`${sticky ? 'sticky top-0' : 'relative'} z-40 flex items-center justify-between gap-3 px-4 md:px-10 h-14 md:h-16`}
      style={{
        background: 'rgba(11,5,7,.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${YELLOW}26`,
      }}
    >
      <Link href="/" className="no-underline" aria-label="Kama OTT home">
        <Logo />
      </Link>
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}

// Small square-cornered action used in headers
export function HeaderAction({
  href,
  onClick,
  children,
  solid = false,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  solid?: boolean;
}) {
  const cls =
    'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12px] font-semibold no-underline transition-colors cursor-pointer';
  const style = solid
    ? { background: GOLD_GRADIENT, color: INK, border: `1px solid ${YELLOW}` }
    : { background: 'transparent', color: 'rgba(246,236,221,.75)', border: `1px solid ${LINE}` };
  return href ? (
    <Link href={href} className={cls} style={style}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 px-4 md:px-10 pt-12 pb-10" style={{ borderTop: `1px solid ${LINE}` }}>
      <p
        className="k-display m-0 select-none leading-none"
        style={{
          fontSize: 'clamp(64px, 16vw, 180px)',
          color: 'transparent',
          WebkitTextStroke: '1px rgba(212,162,76,.22)',
        }}
      >
        KAMA
      </p>
      <div className="mt-6 flex flex-col-reverse md:flex-row md:items-center justify-between gap-4">
        <p className="m-0 text-[12px] text-white/35">© 2026 Kama OTT · kamaott.com · Sirf 18+ ke liye</p>
        <nav className="flex gap-5 text-[13px]">
          {[
            ['Privacy', '/privacy'],
            ['Terms', '/terms'],
            ['Support', '/support'],
          ].map(([t, href]) => (
            <Link key={t} href={href} className="text-white/55 hover:text-[#D4A24C] no-underline transition-colors">
              {t}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export const IconPlay = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z" />
  </svg>
);

export const IconBack = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

export const IconUser = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5" />
  </svg>
);

export const IconHelp = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a8.5 8.5 0 0 1-12.3 7.6L3 21l1.5-5.2A8.5 8.5 0 1 1 21 12Z" />
    <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
  </svg>
);
