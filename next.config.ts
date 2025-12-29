import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel deployment configuration
  poweredByHeader: false,
  compress: true,

  // 페이지 리다이렉트 (301) - dger-api 호환성
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/index2.html', destination: '/', permanent: true },
      { source: '/index3.html', destination: '/', permanent: true },
      { source: '/27severe.html', destination: '/severe', permanent: true },
      { source: '/27severe2.html', destination: '/severe', permanent: true },
      { source: '/systommsg.html', destination: '/messages', permanent: true },
      { source: '/systommsg2.html', destination: '/messages', permanent: true },
      { source: '/feed.html', destination: '/feedback', permanent: true },
      { source: '/lab.html', destination: '/', permanent: true },
    ];
  },

  // API 리라이트 (내부 프록시) - dger-api 호환성
  async rewrites() {
    return [
      { source: '/api/get-bed-info', destination: '/api/bed-info' },
      { source: '/api/get-hospital-list', destination: '/api/hospital-list' },
      { source: '/api/get-emergency-messages', destination: '/api/emergency-messages' },
      { source: '/api/get-severe-diseases', destination: '/api/severe-diseases' },
      { source: '/api/get-severe-acceptance', destination: '/api/severe-acceptance' },
    ];
  },
};

export default nextConfig;
