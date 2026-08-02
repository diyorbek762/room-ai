import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "*.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok.app",
    "*.ngrok-free.app",
  ],
};

export default nextConfig;
