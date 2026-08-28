import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@slave/game', '@slave/shared'],
}

export default nextConfig
