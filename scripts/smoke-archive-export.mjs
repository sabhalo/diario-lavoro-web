import { chromium } from "playwright-core";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const temporary = await mkdtemp(join(tmpdir(), "diario-asr-export-"));
try {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => { window.showDirectoryPicker = async () => navigator.storage.getDirectory(); window.showSaveFilePicker = undefined; });
  await page.goto("http://127.0.0.1:4173/");
  await page.evaluate(async () => {
    const { FileArchive } = await import("/src/archive.js");
    const archive = await FileArchive.open(await navigator.storage.getDirectory());
    const session = { id: "s1", title: "Export ASR", startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), state: "conclusa", timezone: "Europe/Rome" };
    await archive.put("sessions", session);
    await archive.put("recordings", { id: "r1", sessionId: session.id, offsetStartMs: 0, offsetEndMs: 1000, status: "terminata" });
    await archive.writeFragment({ id: "c1", sessionId: session.id, recordingId: "r1", stream: "microfono", index: 0, startMs: 0, endMs: 1000, format: "audio/webm" }, new Blob(["audio!"], { type: "audio/webm" }));
    await archive.put("transcriptRuns", { id: "run1", sessionId: session.id, recordingId: "r1", source: "microfono", path: "browser", model: "test", version: 1, status: "completa", active: true, mediaChunkIds: ["c1"], coverage: [{ startMs: 0, endMs: 1000 }] });
    await archive.put("transcriptSegments", { id: "seg1", runId: "run1", sessionId: session.id, recordingId: "r1", source: "microfono", timed: true, startMs: 100, endMs: 700, text: "ciao", mediaChunkIds: ["c1"] });
  });
  await page.getByRole("button", { name: "Scegli un’altra cartella" }).click();
  await page.getByText("Export ASR").click();
  await page.getByText("ciao").waitFor();
  await page.getByRole("button", { name: "Correggi testo" }).click();
  await page.locator('form[data-form="edit-segment"] textarea').fill("ciao corretto");
  await page.getByRole("button", { name: "Salva nuova versione" }).click();
  await page.getByText("ciao corretto").waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta", exact: true }).click();
  const download = await downloadPromise, zip = join(temporary, "export.zip"); await download.saveAs(zip);
  const report = JSON.parse(execFileSync("python", ["-c", "import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); m=json.loads(z.read('manifest.json')); print(json.dumps({'runs':len(m['transcriptRuns']),'segments':len(m['transcriptSegments']),'text':z.read('trascrizione-attiva.txt').decode(),'raw':len([x for x in z.namelist() if x.startswith('frammenti/')])}))", zip], { encoding: "utf8" }));
  await page.locator("#view > header").getByRole("button", { name: "Rimuovi", exact: true }).click();
  await page.getByRole("button", { name: "Rimuovi dati locali" }).click();
  const afterDelete = await page.evaluate(async () => { const { FileArchive } = await import("/src/archive.js"); const archive = await FileArchive.open(await navigator.storage.getDirectory()); return { sessions: (await archive.all("sessions")).length, runs: (await archive.all("transcriptRuns")).length, segments: (await archive.all("transcriptSegments")).length }; });
  console.log(JSON.stringify({ ...report, afterDelete, errors }));
  if (errors.length || report.runs !== 2 || report.segments !== 2 || !report.text.includes("ciao corretto") || report.raw !== 1 || Object.values(afterDelete).some(Boolean)) process.exitCode = 1;
} finally { await browser.close(); await rm(temporary, { recursive: true, force: true }); }
