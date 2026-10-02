import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(),'../..'),
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
