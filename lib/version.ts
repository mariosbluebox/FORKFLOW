// App version info, sourced from package.json + git at build time (see next.config.ts).
// Used by the version badge in the sidebar so we always know what code is live.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'
export const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'dev'

// e.g. "v0.4.0 · a1b2c3d"
export const VERSION_LABEL = `v${APP_VERSION} · ${COMMIT_SHA}`
