/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['*.trycloudflare.com'],
  // tracker.js çalışma anında diskten okunuyor (src/lib/tracking-script.ts); public/ Vercel'de
  // CDN'e gider, fonksiyon paketine girmez — dosya izlemesine elle ekle.
  outputFileTracingIncludes: {
    '/api/tracking-script/install': ['./public/tracker.js'],
  },
  // Webpack configuration
  webpack: (config) => {
    // Disable fs module on client side (required for Vercel)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };

  
    return config;
  },
};

module.exports = nextConfig; 