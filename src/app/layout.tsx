import type { Metadata } from 'next';
import { Anton, Bebas_Neue, Geist, Geist_Mono, Mukta, Poppins } from 'next/font/google';
import CampaignTracker from '@/components/CampaignTracker';
import { isTestEnv } from '@/lib/appEnv';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Site look: Bebas Neue for headings (Anton kept for the admin panels), Poppins + Mukta for text
const anton = Anton({
  variable: '--font-anton',
  weight: '400',
  subsets: ['latin'],
});

// Kama OTT headings
const bebas = Bebas_Neue({
  variable: '--font-bebas',
  weight: '400',
  subsets: ['latin'],
});

const poppins = Poppins({
  variable: '--font-poppins',
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

const mukta = Mukta({
  variable: '--font-mukta',
  weight: ['400', '600', '800'],
  subsets: ['devanagari', 'latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://kamaott.com'),
  title: 'Kama OTT',
  description: 'Masti Hai To Mast Hai',
  // Keep the test server out of search results
  ...(isTestEnv && { robots: { index: false, follow: false } }),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} ${bebas.variable} ${poppins.variable} ${mukta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {isTestEnv && (
          <div className="sticky top-0 z-[9999] bg-amber-400 py-1 text-center text-xs font-bold text-black">
            TEST MODE: payments go to the SabPaisa sandbox, no real money is charged
          </div>
        )}
        {children}
        <CampaignTracker />
      </body>
    </html>
  );
}
