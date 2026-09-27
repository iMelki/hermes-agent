import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execFileSync } from "child_process";

const BACKEND = process.env.HERMES_DASHBOARD_URL ?? "http://127.0.0.1:9119";

/**
 * Build-identity stamp. Every production bundle must carry the source commit
 * it was built from, or the served artifact is unattributable (see
 * docs/evidence/2026-08-25-hermes-web-bundle-provenance/: the installer's
 * web_dist predated its own source by 16h and could be tied to no commit).
 *
 * Two exposures, both served by the existing static catch-all in
 * hermes_cli/web_server.py with zero server changes:
 *  - `<meta name="hermes-build-commit|time|dirty">` in index.html
 *  - `web_dist/build-info.json` (reachable as GET /build-info.json)
 *
 * Comparable dashboards do the same: Grafana exposes commit via /api/health,
 * Gitea via /api/v1/version, and Vite's own docs recommend define()-time
 * git stamping for release attribution.
 *
 * A build that cannot resolve its commit THROWS — an unstampable bundle is
 * the failure mode this exists to prevent, so it must not build silently.
 * scripts/check-build-stamp.mjs re-verifies the emitted dist after every
 * `npm run build` and fails the build chain if the stamp is missing.
 */
function hermesBuildStamp(): Plugin {
  const repoRoot = path.resolve(__dirname, "..");
  let commit = "";
  let dirty = false;
  let buildTime = "";

  const git = (...args: string[]): string =>
    execFileSync("git", ["-C", repoRoot, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

  return {
    name: "hermes:build-stamp",
    apply: "build",
    buildStart() {
      commit = git("rev-parse", "HEAD");
      if (!/^[0-9a-f]{40}$/.test(commit)) {
        throw new Error(
          `[hermes:build-stamp] git rev-parse HEAD returned "${commit}" — refusing to emit an unattributable bundle`,
        );
      }
      // Dirty only when bundle-relevant sources differ from HEAD; docs and
      // evidence churn elsewhere in the repo must not taint attribution.
      dirty = git("status", "--porcelain", "--", "web", "apps/shared") !== "";
      buildTime = new Date().toISOString();
    },
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          injectTo: "head",
          attrs: { name: "hermes-build-commit", content: commit },
        },
        {
          tag: "meta",
          injectTo: "head",
          attrs: { name: "hermes-build-time", content: buildTime },
        },
        {
          tag: "meta",
          injectTo: "head",
          attrs: { name: "hermes-build-dirty", content: String(dirty) },
        },
      ];
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "build-info.json",
        source:
          JSON.stringify({ commit, dirty, buildTime, schemaVersion: 1 }, null, 2) +
          "\n",
      });
    },
  };
}

/**
 * In production the Python `hermes dashboard` server injects a one-shot
 * session token into `index.html` (see `hermes_cli/web_server.py`). The
 * Vite dev server serves its own `index.html`, so unless we forward that
 * token, every protected `/api/*` call 401s.
 *
 * This plugin fetches the running dashboard's `index.html` on each dev page
 * load, scrapes the `window.__HERMES_SESSION_TOKEN__` assignment, and
 * re-injects it into the dev HTML. No-op in production builds.
 */
function hermesDevToken(): Plugin {
  const TOKEN_RE = /window\.__HERMES_SESSION_TOKEN__\s*=\s*"([^"]+)"/;
  const EMBEDDED_RE =
    /window\.__HERMES_DASHBOARD_EMBEDDED_CHAT__\s*=\s*(true|false)/;

  return {
    name: "hermes:dev-session-token",
    apply: "serve",
    async transformIndexHtml() {
      try {
        const res = await fetch(BACKEND, { headers: { accept: "text/html" } });
        const html = await res.text();
        const match = html.match(TOKEN_RE);
        if (!match) {
          console.warn(
            `[hermes] Could not find session token in ${BACKEND} — ` +
              `is \`hermes dashboard\` running? /api calls will 401.`,
          );
          return;
        }
        const embeddedMatch = html.match(EMBEDDED_RE);
        const embeddedJs = embeddedMatch ? embeddedMatch[1] : "true";
        return [
          {
            tag: "script",
            injectTo: "head",
            children:
              `window.__HERMES_SESSION_TOKEN__="${match[1]}";` +
              `window.__HERMES_DASHBOARD_EMBEDDED_CHAT__=${embeddedJs};`,
          },
        ];
      } catch (err) {
        console.warn(
          `[hermes] Dashboard at ${BACKEND} unreachable — ` +
            `start it with \`hermes dashboard\` or set HERMES_DASHBOARD_URL. ` +
            `(${(err as Error).message})`,
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), hermesDevToken(), hermesBuildStamp()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@hermes/shared": path.resolve(__dirname, "../apps/shared/src"),
    },
    // When @nous-research/ui is symlinked via `file:../../design-language`,
    // Node's module resolution would pick up shared deps from
    // design-language/node_modules/*, giving us two copies + breaking
    // hooks (useRef-of-null), webgl contexts, etc. Force everything that
    // exists in BOTH places to use the dashboard's copy.
    //
    // Don't list packages here that only exist in the DS (nanostores,
    // @nanostores/react) — Vite dedupe errors out when it can't find
    // them at the project root.
    dedupe: [
      "react",
      "react-dom",
      "@react-three/fiber",
      "@observablehq/plot",
      "three",
      "leva",
      "gsap",
    ],
  },
  build: {
    outDir: "../hermes_cli/web_dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: BACKEND,
        ws: true,
      },
      // Same host as `hermes dashboard` must serve these; Vite has no
      // dashboard-plugins/* files, so without this, plugin scripts 404
      // or receive index.html in dev.
      "/dashboard-plugins": BACKEND,
    },
  },
});
