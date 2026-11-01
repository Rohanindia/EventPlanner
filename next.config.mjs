/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typedRoutes: true,
  // Security: prevent server env leaking to client bundle
  serverExternalPackages: ["groq-sdk"],
};

export default nextConfig;
