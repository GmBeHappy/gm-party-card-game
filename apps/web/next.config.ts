import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@cards/game', '@cards/shared'],
  /**
   * Bundle the server and only the files it actually traced, so the runtime
   * image carries no node_modules tree and no build toolchain.
   */
  output: 'standalone',
  /**
   * Tracing has to start at the workspace root, or the two local packages the
   * app transpiles are left out of the standalone output.
   */
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
}

export default nextConfig
