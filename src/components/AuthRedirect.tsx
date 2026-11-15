'use client';

import { useRedirectIfLoggedIn } from '@/lib/useRedirectIfLoggedIn';

// Bounces already-logged-in users off /auth (e.g. Back from home restoring the page from bfcache)
export default function AuthRedirect() {
  useRedirectIfLoggedIn();
  return null;
}
