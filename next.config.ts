import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required for Netlify/Amplify deployment
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
}

export default nextConfig
