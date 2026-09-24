import { chromium } from "playwright-core";
import { readFile } from "node:fs/promises";

const wav = await readFile("test/fixtures/italiano-cc0-4000000037-16k.wav");
const samples = Array.from({ length: (wav.length - 44) / 2 }, (_, i) => wav.readInt16LE(44 + i * 2) / 32768);

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-unsafe-webgpu"] });
try {
  const page = await browser.newPage();
  page.on("console", (message) => { if (message.type() === "warning" || message.type() === "error") console.error(`browser: ${message.text()}`); });
  await page.goto("http://127.0.0.1:4173/");
  const transcribe = () => page.evaluate(async (input) => {
    const { loadWhisper } = await import("/src/browser-asr.bundle.js");
    const model = "onnx-community/whisper-large-v3-turbo";
    const adapter = await navigator.gpu?.requestAdapter();
    const started = performance.now();
    const pipe = await loadWhisper(model, { device: "webgpu", dtype: "q4f16" });
    const loadedSeconds = (performance.now() - started) / 1000;
    const inferStarted = performance.now();
    const transcript = await pipe(Float32Array.from(input), { language: "italian", task: "transcribe", return_timestamps: true });
    return { model, adapter: adapter?.info || null, loadedSeconds, inferenceSeconds: (performance.now() - inferStarted) / 1000, transcript };
  }, samples);
  const online = await transcribe();
  const cache = await page.evaluate(async () => ({ storage: await navigator.storage.estimate(), caches: await Promise.all((await caches.keys()).map(async (name) => ({ name, files: (await (await caches.open(name)).keys()).length }))) }));
  await page.reload();
  await page.route("**/*", (route) => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  let offline;
  try { offline = await transcribe(); } catch (error) { offline = { error: String(error) }; }
  console.log(JSON.stringify({ online, cache, offline }));
  const reference = "Aspettiamo un po', perché a volte ci vuole un po' di tempo.";
  if (offline.error || online.transcript?.text?.trim() !== reference || offline.transcript?.text?.trim() !== reference) process.exitCode = 1;
} finally {
  await browser.close();
}
