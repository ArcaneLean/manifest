// Which build this is: "main" (the real app, served from the site root) or a
// PR preview ("pr-<n>", served from <root>/preview/pr-<n>/) — see
// ARCHITECTURE.md §7 ("PR previews"). Set at build time by deploy.yml; a
// local `npm run dev` / unset env is "main".
//
// Every build is served from the same GitHub Pages origin, so IndexedDB and
// localStorage are shared between them. Previews therefore namespace both,
// so a preview can never upgrade (and lock main out of) the real database or
// overwrite the real app's view prefs.
export const CHANNEL = import.meta.env.VITE_CHANNEL || "main";
export const IS_PREVIEW = CHANNEL !== "main";

export const PREVIEW_INFO = IS_PREVIEW
  ? {
      pr: Number(import.meta.env.VITE_PR_NUMBER) || null,
      branch: import.meta.env.VITE_BRANCH || null,
      sha: import.meta.env.VITE_COMMIT || null,
    }
  : null;

export const MAIN_DB_NAME = "manifest";

export function dbNameFor(channel) {
  return channel === "main" ? MAIN_DB_NAME : `${MAIN_DB_NAME}@${channel}`;
}

export function storageKeyFor(key, channel) {
  return channel === "main" ? key : `${key}@${channel}`;
}

// localStorage key for this build — unchanged on main, suffixed in previews.
export function storageKey(key) {
  return storageKeyFor(key, CHANNEL);
}

// Site root (where main and versions.json live), from a page URL of the given
// channel's build. Previews sit two levels down: <root>/preview/pr-<n>/.
export function siteRootFor(pageUrl, channel) {
  return new URL(channel === "main" ? "./" : "../../", pageUrl).href;
}

export function siteRoot() {
  return siteRootFor(window.location.href, CHANNEL);
}
