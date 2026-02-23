/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // output: 'standalone', // Uncomment if you want to use standalone output for Docker/VPS
  experimental: {
    // optimizeCss: true, // Requires 'critters' package
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
