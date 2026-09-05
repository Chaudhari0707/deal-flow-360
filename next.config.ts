import type { NextConfig } from "next";

function securityHeaders() {
  const isDevelopment = Bun.env.NODE_ENV === "development";
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws://127.0.0.1:3101 ws://127.0.0.1:3102",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
  ];
}

const nextConfig: NextConfig = {
  distDir: Bun.env.NEXT_DIST_DIR ?? ".next",
  logging: { incomingRequests: { ignore: [/\/portal\/access/] } },
  // Bundle document exporters and their default-external helpers: Bun cannot resolve
  // Turbopack's newly generated hashed external aliases on the first cold request.
  transpilePackages: ["exceljs", "pdf-lib", "rimraf", "prettier"],
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  reactCompiler: true,
  experimental: {
    useTypeScriptCli: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
};

export default nextConfig;
