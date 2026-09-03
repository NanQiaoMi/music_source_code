/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.STATIC_EXPORT ? "export" : undefined,
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config, { isServer }) => {
    // ... webpack config (preserving existing)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("@xenova/transformers");
      config.externals.push("onnxruntime-node");
      config.externals.push("sharp");
    }

    config.resolve = config.resolve || {};
    config.resolve.fallback = config.resolve.fallback || {};
    config.resolve.fallback.fs = false;
    config.resolve.fallback["react-native-fs"] = false;
    config.resolve.fallback.sharp = false;
    config.resolve.fallback["onnxruntime-node"] = false;

    // Performance optimization: fine-grained splitChunks isolating heavy libraries
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: "all",
        minSize: 20000,
        maxSize: 300000,
        cacheGroups: {
          default: false,
          framework: {
            name: "framework",
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/,
            priority: 40,
            chunks: "all",
          },
          three: {
            name: "chunk-three",
            test: /[\\/]node_modules[\\/](three)[\\/]/,
            priority: 35,
            chunks: "async",
            reuseExistingChunk: true,
          },
          fabric: {
            name: "chunk-fabric",
            test: /[\\/]node_modules[\\/](fabric)[\\/]/,
            priority: 35,
            chunks: "async",
            reuseExistingChunk: true,
          },
          ffmpeg: {
            name: "chunk-ffmpeg",
            test: /[\\/]node_modules[\\/](@ffmpeg)[\\/]/,
            priority: 35,
            chunks: "async",
            reuseExistingChunk: true,
          },
          framerMotion: {
            name: "chunk-framer-motion",
            test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
            priority: 30,
            chunks: "all",
          },
          lucide: {
            name: "chunk-lucide",
            test: /[\\/]node_modules[\\/](lucide-react)[\\/]/,
            priority: 25,
            chunks: "all",
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            priority: 10,
            chunks: "all",
            reuseExistingChunk: true,
          },
        },
      };
    }

    return config;
  },
  onDemandEntries: {
    // Keep pages in memory longer for snappier navigation in dev
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  experimental: {
    optimizeCss: false, // Disabling to fix 'critters' not found error

    scrollRestoration: true,
  },
  poweredByHeader: false,
  compress: true,

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "p1.music.126.net",
      },
      {
        protocol: "https",
        hostname: "p2.music.126.net",
      },
      {
        protocol: "https",
        hostname: "p3.music.126.net",
      },
      {
        protocol: "https",
        hostname: "p4.music.126.net",
      },
    ],
  },
};

module.exports = nextConfig;
