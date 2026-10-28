import { readFile, writeFile, mkdir } from "node:fs/promises";
const source = await readFile(
  new URL("../src/pwa/service-worker.js", import.meta.url),
  "utf8",
);
// Every build gets an isolated shell cache and a changed worker script.
const version = `${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local"}-${Date.now()}`;
await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../public/sw.js", import.meta.url),
  source.replaceAll("__NIGHTLINE_BUILD__", version),
);
