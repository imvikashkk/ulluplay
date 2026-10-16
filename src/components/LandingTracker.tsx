'use client';

import { useEffect, useRef } from 'react';
import { useRedirectIfLoggedIn } from '@/lib/useRedirectIfLoggedIn';
import type { Variant } from '@/lib/landingAb';

// The only client JS on /auth besides the form: bounces logged-in users, and for a visitor new to
// this test run counts the visit + pins the variant in a cookie so a refresh shows the same design
export default function LandingTracker({ assign }: { assign: { run: number; variant: Variant } | null }) {
  useRedirectIfLoggedIn();
  const sent = useRef(false);

  useEffect(() => {
    if (!assign || sent.current) return;
    sent.current = true;
    fetch('/api/landing/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assign),
    }).catch(() => {});
  }, [assign]);

  return null;
}
