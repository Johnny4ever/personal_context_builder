/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiUrl = process.env.BACKEND_URL ?? "http://backend:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
