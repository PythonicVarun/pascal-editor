import type { NextConfig } from 'next'

const AGENT_RUNNER_URL = process.env.AGENT_RUNNER_URL ?? 'http://localhost:4000'

const nextConfig: NextConfig = {
  logging: {
    browserToTerminal: true,
  },
  async rewrites() {
    return [
      { source: '/agent-runner/api/:path*', destination: `${AGENT_RUNNER_URL}/api/:path*` },
      { source: '/agent-runner/socket.io/:path*', destination: `${AGENT_RUNNER_URL}/socket.io/:path*` },
      { source: '/agent-runner/ttyd/:path*', destination: `${AGENT_RUNNER_URL}/ttyd/:path*` },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    'three',
    '@pascal-app/viewer',
    '@pascal-app/core',
    '@pascal-app/editor',
    '@pascal-app/mcp',
  ],
  turbopack: {
    resolveAlias: {
      react: './node_modules/react',
      three: './node_modules/three',
      '@react-three/fiber': './node_modules/@react-three/fiber',
      '@react-three/drei': './node_modules/@react-three/drei',
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  images: {
    unoptimized: process.env.NEXT_PUBLIC_ASSETS_CDN_URL?.startsWith('http://localhost') ?? false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  allowedDevOrigins: ['localhost', '127.0.0.1']
}

export default nextConfig
