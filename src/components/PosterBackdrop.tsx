import type { ReactNode } from 'react';
import { MOVIES, SERIES } from '@/data/content';

// Full-screen OTT poster wall for /auth and /subscription — tilted columns of series posters drifting
// up/down, under a dark vignette. Real posters from content.json are mixed in between CSS/SVG-drawn ones.

type Art = 'sun' | 'city' | 'hills' | 'rings' | 'rays' | 'moon';
type Poster = { title: string; genre: string; from: string; to: string; art: Art; tag?: string };

const POSTERS: Poster[] = [
  { title: 'Haveli', genre: 'Thriller', from: '#7f1d1d', to: '#1c0a0a', art: 'moon', tag: 'NEW' },
  { title: 'Shehar', genre: 'Crime', from: '#1e3a8a', to: '#0b1020', art: 'city' },
  { title: 'Pehli Mulaqat', genre: 'Romance', from: '#be185d', to: '#2a0a18', art: 'sun', tag: 'TOP 10' },
  { title: 'Gaon Ki Kahani', genre: 'Drama', from: '#a16207', to: '#1f1405', art: 'hills' },
  { title: 'Chakravyuh', genre: 'Action', from: '#c2410c', to: '#1a0a04', art: 'rays', tag: 'NEW' },
  { title: 'Raaz', genre: 'Mystery', from: '#4c1d95', to: '#0f0820', art: 'rings' },
  { title: 'Mohalla', genre: 'Comedy', from: '#0f766e', to: '#04201d', art: 'city' },
  { title: 'Baazi', genre: 'Thriller', from: '#991b1b', to: '#140606', art: 'rays' },
  { title: 'Safar', genre: 'Drama', from: '#0369a1', to: '#06121c', art: 'hills', tag: 'TOP 10' },
  { title: 'Dhadkan', genre: 'Romance', from: '#db2777', to: '#22061a', art: 'moon' },
  { title: 'Khiladi', genre: 'Action', from: '#b45309', to: '#190d03', art: 'sun' },
  { title: 'Rishta', genre: 'Family', from: '#7c3aed', to: '#140a26', art: 'rings', tag: 'NEW' },
];

function Motif({ art }: { art: Art }): ReactNode {
  const s = { fill: 'none', stroke: 'rgba(255,255,255,.35)', strokeWidth: 1.5 };
  switch (art) {
    case 'sun':
      return (
        <>
          <circle cx="50" cy="62" r="26" fill="rgba(250,204,21,.55)" />
          {[78, 86, 94].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} {...s} />)}
        </>
      );
    case 'moon':
      return (
        <>
          <circle cx="66" cy="34" r="16" fill="rgba(255,255,255,.75)" />
          <circle cx="72" cy="30" r="14" fill="rgba(0,0,0,.45)" />
          <path d="M10 110 L10 70 L30 58 L50 70 L50 110Z M54 110 L54 80 L74 68 L94 80 L94 110Z" fill="rgba(0,0,0,.55)" />
        </>
      );
    case 'city':
      return (
        <path
          d="M0 110 V70 H12 V52 H24 V76 H34 V40 H48 V64 H58 V30 H70 V58 H80 V48 H92 V72 H100 V110Z"
          fill="rgba(0,0,0,.55)"
          stroke="rgba(250,204,21,.4)"
        />
      );
    case 'hills':
      return (
        <>
          <circle cx="30" cy="34" r="10" fill="rgba(255,255,255,.6)" />
          <path d="M0 110 L0 72 L28 50 L52 74 L76 46 L100 70 L100 110Z" fill="rgba(0,0,0,.5)" />
          <path d="M0 110 L0 88 L40 70 L70 90 L100 80 L100 110Z" fill="rgba(0,0,0,.6)" />
        </>
      );
    case 'rings':
      return (
        <>
          {[34, 26, 18, 10].map((r) => <circle key={r} cx="50" cy="50" r={r} {...s} />)}
          <circle cx="50" cy="50" r="4" fill="rgba(250,204,21,.8)" />
        </>
      );
    case 'rays':
      return (
        <>
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1="50" y1="110" x2={i * 12.5} y2="0" {...s} />
          ))}
          <path d="M38 110 L44 70 L56 70 L62 110Z" fill="rgba(0,0,0,.6)" />
          <circle cx="50" cy="62" r="7" fill="rgba(0,0,0,.6)" />
        </>
      );
  }
}

function PosterCard({ p }: { p: Poster }) {
  return (
    <div
      className="relative w-full aspect-[2/3] overflow-hidden rounded-lg"
      style={{
        background: `linear-gradient(160deg, ${p.from} 0%, ${p.to} 100%)`,
        boxShadow: '0 10px 30px -10px rgba(0,0,0,.9), inset 0 0 0 1px rgba(255,255,255,.06)',
      }}
    >
      <svg viewBox="0 0 100 110" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
        <Motif art={p.art} />
      </svg>
      <span className="absolute left-2 top-2 text-[13px] font-black leading-none" style={{ color: '#EF233C' }}>
        U
      </span>
      {p.tag && (
        <span
          className="absolute right-0 top-2 px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider"
          style={{ background: '#EF233C', color: '#fff' }}
        >
          {p.tag}
        </span>
      )}
      <div
        className="absolute inset-x-0 bottom-0 px-2 pb-2 pt-8"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,.9), transparent)' }}
      >
        <div className="text-[9px] font-semibold tracking-[.2em] text-white/60">ULLU PLAY</div>
        <div className="text-[15px] font-extrabold leading-tight text-white">{p.title}</div>
        <div className="mt-0.5 text-[9px] font-medium text-white/60">{p.genre}</div>
      </div>
    </div>
  );
}

// Real catalogue posters, one after every drawn one, so the wall reads as the actual library
const REAL: string[] = [...SERIES, ...MOVIES].map((t) => t.poster).filter(Boolean);
type Tile = { kind: 'drawn'; p: Poster } | { kind: 'real'; src: string };
const TILES: Tile[] = POSTERS.flatMap((p, i): Tile[] =>
  REAL.length ? [{ kind: 'drawn', p }, { kind: 'real', src: REAL[i % REAL.length] }] : [{ kind: 'drawn', p }],
);

function RealCard({ src }: { src: string }) {
  return (
    <div
      className="relative w-full aspect-[2/3] overflow-hidden rounded-lg bg-white/5"
      style={{ boxShadow: '0 10px 30px -10px rgba(0,0,0,.9), inset 0 0 0 1px rgba(255,255,255,.06)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
    </div>
  );
}

const COLUMNS = 16;

export default function PosterBackdrop({ dim = 0 }: { dim?: number }) {
  return (
    <div className="fixed inset-0 overflow-hidden" aria-hidden style={{ background: '#0C0809' }}>
      <style>{`
        @keyframes kpUp   { from { transform: translateY(0); }    to { transform: translateY(-50%); } }
        @keyframes kpDown { from { transform: translateY(-50%); } to { transform: translateY(0); } }
        .kp-up   { animation: kpUp 90s linear infinite; }
        .kp-down { animation: kpDown 90s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .kp-up, .kp-down { animation: none; } }
      `}</style>

      {/* Tilted wall, oversized so the rotation never shows an edge */}
      <div
        className="absolute left-1/2 top-1/2 grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${COLUMNS}, 150px)`,
          transform: 'translate(-50%, -50%) rotate(-12deg)',
        }}
      >
        {Array.from({ length: COLUMNS }, (_, c) => {
          // Rotate the list per column so neighbours never line up the same poster
          const k = (c * 5) % TILES.length;
          const list = [...TILES.slice(k), ...TILES.slice(0, k)];
          return (
            <div key={c} className="overflow-hidden" style={{ height: '220vh', marginTop: c % 2 ? '-90px' : 0 }}>
              <div className={`flex flex-col gap-3 ${c % 2 ? 'kp-down' : 'kp-up'}`}>
                {[...list, ...list].map((t, i) =>
                  t.kind === 'real' ? <RealCard key={i} src={t.src} /> : <PosterCard key={i} p={t.p} />,
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dark overlay + vignette so the form stays the hero */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 65% at 50% 50%, rgba(12,8,9,.68) 0%, rgba(12,8,9,.88) 100%),
            linear-gradient(to bottom, rgba(12,8,9,.6), transparent 25%, transparent 75%, rgba(12,8,9,.85)),
            rgba(12,8,9,${dim})`,
        }}
      />
    </div>
  );
}
