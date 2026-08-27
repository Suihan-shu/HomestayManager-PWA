import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("builds a GitHub Pages app shell under the repository path", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>HomestayManager APP<\/title>/i);
  assert.match(html, /\.\/manifest\.webmanifest/);
  assert.match(html, /\/HomestayManager-PWA\/assets\//);
  assert.match(html, /icon-192\.png/);
});

test("keeps local persistence, backup, conflict protection and offline support", async () => {
  const assetNames = await readdir(new URL("../dist/assets/", import.meta.url));
  const scriptName = assetNames.find((name) => name.endsWith(".js"));
  assert.ok(scriptName, "compiled JavaScript bundle is missing");

  const [source, script, serviceWorker, manifest] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL(`../dist/assets/${scriptName}`, import.meta.url), "utf8"),
    readFile(new URL("../dist/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../dist/manifest.webmanifest", import.meta.url), "utf8"),
  ]);

  assert.match(source, /stayOverlaps/);
  assert.match(source, /localStorage\.setItem/);
  assert.match(script, /导出备份/);
  assert.match(script, /删除住宿记录/);
  assert.match(serviceWorker, /caches\.match/);
  assert.match(serviceWorker, /BASE_URL/);
  assert.equal(JSON.parse(manifest).display, "standalone");
});
