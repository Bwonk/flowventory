/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['*.trycloudflare.com'],
  // tracker.js çalışma anında diskten okunuyor (src/lib/tracking-script.ts); public/ Vercel'de
  // CDN'e gider, fonksiyon paketine girmez — dosya izlemesine elle ekle.
  outputFileTracingIncludes: {
    '/api/tracking-script/install': ['./public/tracker.js'],
    // Sipariş PDF'i (react-pdf) fontları diskten okur — e-posta eki ve PDF indirme.
    '/api/purchase-orders/send': ['./src/lib/documents/fonts/*.ttf'],
    '/api/purchase-orders/[id]/pdf': ['./src/lib/documents/fonts/*.ttf'],
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