import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the HomestayManager app shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>HomestayManager APP<\/title>/i);
  assert.match(html, /房态/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /icon-192\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("includes local persistence, conflict protection and offline support", async () => {
  const [page, serviceWorker, manifest] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /newCheckIn|stayOverlaps|checkInDate < b\.checkOutDate/);
  assert.match(page, /localStorage\.setItem/);
  assert.match(page, /导出备份/);
  assert.match(page, /删除住宿记录/);
  assert.match(serviceWorker, /caches\.match/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
  assert.match(manifest, /display: "standalone"/);
});
