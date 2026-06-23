/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa'

const pwaConfig = withPWA({
  dest: 'public',
  // O registo do SW é feito por nós (src/lib/push.ts → /push-worker.js), um SW
  // mínimo dedicado ao push. O SW pesado do next-pwa não instalava no iOS.
  register: false,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'nexus-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
        networkTimeoutSeconds: 10,
      },
    },
  ],
})

const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: ['localhost:3001'] } },
}

export default pwaConfig(nextConfig)
