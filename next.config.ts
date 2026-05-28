import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options',        value: 'DENY' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Control referrer information
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  // Enable XSS filter in older browsers
  { key: 'X-XSS-Protection',       value: '1; mode=block' },
  // Allow camera/mic/geolocation only on same origin (needed for QR scan, voice call, location)
  { key: 'Permissions-Policy',     value: 'camera=(self), microphone=(self), geolocation=(self)' },
]

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
