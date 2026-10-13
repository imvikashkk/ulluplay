import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only — lets phones/laptops on the LAN load HMR when opening the site by IP
  allowedDevOrigins: ['next-dev.vikashkk.com', 'localhost', '127.0.0.1', '192.168.1.4', '192.168.*.*'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img-rsms.b-cdn.net',
      },
      {
        protocol: 'https',
        hostname: 'image-kaamaott.b-cdn.net',
      },
    ],
  },
  reactCompiler: true,
};

export default nextConfig;



 
