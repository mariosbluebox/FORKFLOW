import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

// Resolve the short git commit hash so the app can show exactly which code is live.
function resolveCommitSha(): string {
  // On Vercel the commit SHA is provided as an env var at build time.
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);
  // Locally, ask git directly.
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  // Inlined into the bundle at build time so the version badge can read them.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_COMMIT_SHA: resolveCommitSha(),
  },
};

export default nextConfig;
