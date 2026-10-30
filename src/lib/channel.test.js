import { describe, it, expect } from "vitest";
import { dbNameFor, storageKeyFor, siteRootFor } from "./channel.js";

describe("channel namespacing", () => {
  it("leaves main's database and keys untouched", () => {
    expect(dbNameFor("main")).toBe("manifest");
    expect(storageKeyFor("manifest.nav.app", "main")).toBe("manifest.nav.app");
  });

  it("gives each preview its own database and keys", () => {
    expect(dbNameFor("pr-47")).toBe("manifest@pr-47");
    expect(storageKeyFor("manifest.nav.app", "pr-47")).toBe("manifest.nav.app@pr-47");
  });

  it("resolves the site root from either kind of build", () => {
    expect(siteRootFor("https://u.github.io/manifest/", "main")).toBe("https://u.github.io/manifest/");
    expect(siteRootFor("https://u.github.io/manifest/index.html", "main")).toBe("https://u.github.io/manifest/");
    expect(siteRootFor("https://u.github.io/manifest/preview/pr-47/", "pr-47")).toBe("https://u.github.io/manifest/");
  });
});
