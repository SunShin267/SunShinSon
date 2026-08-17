import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const basePath = process.env.BASE_PATH || "";

const localConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/do-vui-do-meo",
          destination: "/do-vui-do-meo.html",
        },
        {
          source: "/tinh-nhanh",
          destination: "/tinh-nhanh.html",
        },
        {
          source: "/sudoku",
          destination: "/sudoku.html",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

const githubPagesConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    tsconfigPath: "tsconfig.pages.json",
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

const nextConfig = isGitHubPages ? githubPagesConfig : localConfig;

export default nextConfig;
