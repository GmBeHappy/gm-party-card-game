import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@cards/game', '@cards/shared'],
}

export default nextConfig
