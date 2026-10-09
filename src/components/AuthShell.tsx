'use client';

import Link from 'next/link';
import PosterBackdrop from './PosterBackdrop';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Clapperboard, Clock, Drama, Film, Heart, MonitorPlay, Play, Smartphone, Tv } from 'lucide-react';

export const RED = '#EF233C';
export const YELLOW = '#FACC15';
export const INK = '#0C0809';
// Plain, easy-to-read faces: Poppins for Latin, Mukta picks up Devanagari
export const FONT = "'Poppins', 'Mukta', system-ui, sans-serif";

// Word with an animated red→yellow shine
export function Hot({ children }: { children: ReactNode }) {
  return <span className="ka-hot">{children}</span>;
}

export function BrandLogo() {
  return (
    <div className="inline-flex items-center gap-2 select-none">
      <span className="ka-logo text-[34px] font-black tracking-wider leading-none">ULLU</span>
      <span className="text-[10px] font-bold tracking-[.25em] px-1.5 py-0.5 rounded" style={{ color: INK, background: YELLOW }}>
        PLAY
      </span>
    </div>
  );
}

// One-liners for the two scrolling strips — Hinglish, short, high-contrast
type Line = { icon: LucideIcon; text: string };
const TOP_LINES: Line[] = [
  { icon: Clapperboard, text: 'Nayi web series' },
  { icon: CalendarDays, text: 'हर हफ्ते नए एपिसोड' },
  { icon: MonitorPlay, text: 'Full HD' },
  { icon: Drama, text: 'Desi कहानियाँ' },
  { icon: Clock, text: 'Kabhi bhi, kahin bhi' },
];
const BOTTOM_LINES: Line[] = [
  { icon: Film, text: 'Original drama' },
  { icon: Heart, text: 'Desi romance' },
  { icon: Smartphone, text: 'Mobile pe dekho' },
  { icon: Play, text: 'बिना रुकावट स्ट्रीमिंग' },
  { icon: Tv, text: 'Naye episodes' },
];

// Infinite strip of small cards; the list is rendered twice so translateX(-50%) loops seamlessly
function Marquee({ items, reverse = false }: { items: Line[]; reverse?: boolean }) {
  return (
    <div
      className="overflow-hidden"
      style={{
        maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
      }}
    >
      <div className={`flex w-max gap-2.5 ${reverse ? 'ka-marquee-rev' : 'ka-marquee'}`}>
        {[...items, ...items].map(({ icon: Icon, text }, i) => (
          <span
            key={i}
            aria-hidden={i >= items.length}
            className="shrink-0 inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold text-white"
            style={{
              background: 'rgba(12,8,9,.6)',
              border: `1px solid ${RED}66`,
              boxShadow: `0 4px 16px -6px ${RED}88`,
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            <Icon size={16} strokeWidth={2.25} style={{ color: YELLOW }} aria-hidden />
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

// Shared frame for /auth and /auth/otp: full-screen background image, scrolling hot-line strips top and bottom, centered glass card
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] text-white overflow-x-hidden" style={{ background: INK, fontFamily: FONT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&family=Mukta:wght@400;600;700;800&display=swap');
        @keyframes kaRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes kaShine { to { background-position: 200% center; } }
        @keyframes kaScroll { to { transform: translateX(-50%); } }
        @keyframes kaGlow { 0%,100% { box-shadow: 0 10px 30px -10px ${RED}cc; } 50% { box-shadow: 0 10px 40px -6px ${YELLOW}aa; } }
        .ka-rise { animation: kaRise .7s cubic-bezier(.22,1,.36,1) both; }
        .ka-marquee { animation: kaScroll 28s linear infinite; }
        .ka-marquee-rev { animation: kaScroll 28s linear infinite reverse; }
        .ka-hot {
          background: linear-gradient(90deg, #ff4d6d, ${YELLOW}, #ff9a3c, #ff4d6d);
          background-size: 200% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: kaShine 2.5s linear infinite;
          font-weight: 800;
        }
        /* Solid bright logo — gradient text lost contrast on the busy background */
        @keyframes kaLogoGlow {
          0%,100% { text-shadow: 0 2px 0 #b91c1c, 0 4px 14px rgba(0,0,0,.9), 0 0 18px ${RED}99; }
          50%     { text-shadow: 0 2px 0 #b91c1c, 0 4px 14px rgba(0,0,0,.9), 0 0 30px ${RED}; }
        }
        .ka-logo { color: #FFD60A; animation: kaLogoGlow 2.4s ease-in-out infinite; }
        .ka-btn {
          background: linear-gradient(90deg, #d90429, ${RED}, #ff7a18, ${YELLOW}, #ff7a18, ${RED}, #d90429);
          background-size: 300% auto;
          animation: kaShine 4s linear infinite, kaGlow 2.4s ease-in-out infinite;
        }
        .ka-btn:disabled { animation: none; }
        @keyframes kaShake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-7px); } 40%,80% { transform: translateX(7px); } }
        .ka-shake { animation: kaShake .4s ease-in-out; }
        @keyframes kaNudge { 0%,100% { transform: translateX(0); } 50% { transform: translateX(5px); } }
        .ka-nudge { animation: kaNudge 1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ka-hot, .ka-btn, .ka-marquee, .ka-marquee-rev, .ka-logo, .ka-nudge { animation: none; }
        }
      `}</style>

      <PosterBackdrop />

      {/* Scrolling strips pinned to the top and bottom edges */}
      <div className="absolute top-3 inset-x-0 z-20">
        <Marquee items={TOP_LINES} />
      </div>
      <div className="absolute bottom-3 inset-x-0 z-20">
        <Marquee items={BOTTOM_LINES} reverse />
      </div>

      <div className="relative z-10 min-h-[100dvh] flex flex-col items-center justify-center px-4 py-20">
        <div
          className="ka-rise w-full max-w-sm rounded-3xl p-6"
          style={{
            background: 'rgba(12,8,9,.38)',
            border: `1px solid ${YELLOW}33`,
            backdropFilter: 'blur(14px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.3)',
            boxShadow: `0 30px 80px -20px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06), 0 0 60px -25px ${RED}`,
          }}
        >
          {children}

          <p className="mt-5 text-center text-xs leading-relaxed text-white/60">
            Aage badhne par aap{' '}
            <Link href="/terms" className="text-white underline underline-offset-2">
              Terms
            </Link>{' '}
            aur{' '}
            <Link href="/privacy" className="text-white underline underline-offset-2">
              Privacy
            </Link>{' '}
            maante ho. Koi dikkat?{' '}
            <Link href="/support" className="text-white underline underline-offset-2">
              Contact
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
