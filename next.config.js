/* eslint-env node */
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

    // Performance optimization: semantic splitChunks (S4-3a).
    // Shared chunks are extracted from initial chunks only, so libraries reached
    // solely through await import() (jsmediatags, @mediapipe/tasks-vision) stay in
    // their async chunks instead of leaking into rootMainFiles.
    // Rollback: SPLIT_CHUNKS=off npm run build restores the previous config.
    if (!isServer) {
      const asyncVendorGroups = {
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
      };
      const frameworkGroup = {
        name: "framework",
        test: /[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/,
        priority: 40,
        chunks: "all",
      };
      config.optimization.splitChunks =
        process.env.SPLIT_CHUNKS === "off"
          ? {
              chunks: "all",
              minSize: 20000,
              maxSize: 300000,
              cacheGroups: {
                default: false,
                framework: frameworkGroup,
                ...asyncVendorGroups,
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
            }
          : {
              chunks: "initial",
              minSize: 20000,
              cacheGroups: {
                default: false,
                framework: frameworkGroup,
                ...asyncVendorGroups,
                mediapipe: {
                  name: "chunk-mediapipe",
                  test: /[\\/]node_modules[\\/](@mediapipe)[\\/]/,
                  priority: 36,
                  chunks: "async",
                },
                vendorUi: {
                  name: "vendor-ui",
                  test: /[\\/]node_modules[\\/](framer-motion|lucide-react)[\\/]/,
                  priority: 30,
                  chunks: "initial",
                },
                vendor: {
                  test: /[\\/]node_modules[\\/]/,
                  name: "vendor-core",
                  priority: 10,
                  chunks: "initial",
                  reuseExistingChunk: true,
                },
                // Async chunks are not covered by chunks:"initial"; dedupe modules
                // shared by 2+ lazy chunks so the vendor split does not duplicate them.
                asyncShared: {
                  chunks: "async",
                  minChunks: 2,
                  priority: 9,
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
