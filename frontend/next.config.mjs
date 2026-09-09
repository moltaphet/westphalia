/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three.js ships as ESM; ensure it is transpiled cleanly by Next.
  transpilePackages: ["three"],
};

export default nextConfig;
