import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
try {
  const page = await browser.newPage();
  const errors = [], requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.url().includes(":8765/asr")) requests.push(request.method()); });
  await page.addInitScript(() => { window.showDirectoryPicker = async () => navigator.storage.getDirectory(); });
  await page.goto("http://127.0.0.1:4173/");
  await page.evaluate(async () => {
    const { FileArchive } = await import("/src/archive.js");
    const response = await fetch("/test/fixtures/italiano-cc0-4000000037-16k.wav");
    const audio = new AudioContext(), decoded = await audio.decodeAudioData(await response.arrayBuffer());
    const source = audio.createBufferSource(), destination = audio.createMediaStreamDestination(); source.buffer = decoded; source.connect(destination);
    const recorder = new MediaRecorder(destination.stream, { mimeType: "audio/webm;codecs=opus" }), blobs = [];
    recorder.ondataavailable = (event) => { if (event.data.size) blobs.push(event.data); };
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; }), finished = new Promise((resolve) => { source.onended = resolve; });
    recorder.start(500); source.start(); await finished; await new Promise((resolve) => setTimeout(resolve, 200)); recorder.stop(); await stopped; await audio.close();
    const archive = await FileArchive.open(await navigator.storage.getDirectory());
    const session = { id: "s1", title: "ASR UI E2E", startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), state: "conclusa", timezone: "Europe/Rome" };
    await archive.put("sessions", session);
    await archive.put("recordings", { id: "r1", sessionId: "s1", mode: "solo audio", offsetStartMs: 0, offsetEndMs: 3000, status: "terminata", audioSources: { microfono: true, systemAudio: true }, updatedAt: new Date().toISOString() });
    for (const stream of ["microfono", "systemAudio"]) for (let i = 0; i < blobs.length; i++) await archive.writeFragment({ id: `${stream}-${i}`, sessionId: "s1", recordingId: "r1", stream, index: i, startMs: i * 500, endMs: (i + 1) * 500, format: recorder.mimeType }, blobs[i]);
  });
  await page.getByRole("button", { name: "Scegli un’altra cartella" }).click();
  await page.getByText("ASR UI E2E").click();
  await page.locator("#asr-path").selectOption("local");
  if (requests.length) throw new Error("ASR invoked before the explicit click");
  await page.evaluate(() => { const button = document.querySelector('[data-action="transcribe-session"]'); button.click(); button.click(); });
  await page.locator("#asr-progress").waitFor({ state: "visible", timeout: 10_000 });
  const during = await page.evaluate(async () => { const { FileArchive } = await import("/src/archive.js"); const archive = await FileArchive.open(await navigator.storage.getDirectory()); return (await archive.all("transcriptRuns")).map((run) => run.status); });
  await page.getByRole("button", { name: "Ricerca" }).click();
  await page.waitForFunction(async () => { const { FileArchive } = await import("/src/archive.js"); const archive = await FileArchive.open(await navigator.storage.getDirectory()); const runs = await archive.all("transcriptRuns"); return runs.length >= 2 && runs.every((run) => run.status === "completa"); }, null, { timeout: 180_000 });
  if (await page.getByRole("heading", { name: "Ricerca" }).count() !== 1) throw new Error("Il job ASR ha sovrascritto la vista Ricerca.");
  await page.getByRole("button", { name: "Cattura" }).click();
  await page.locator("#asr-progress").waitFor({ state: "hidden", timeout: 180_000 });
  const outcome = await page.evaluate(async () => { const { FileArchive } = await import("/src/archive.js"); const archive = await FileArchive.open(await navigator.storage.getDirectory()); return { runs: (await archive.all("transcriptRuns")).map((run) => ({ source: run.source, status: run.status, coverage: run.coverage.length, error: run.error })), segments: (await archive.all("transcriptSegments")).map((segment) => ({ source: segment.source, text: segment.text })) }; });
  console.log(JSON.stringify({ ...outcome, during, requests, errors }));
  if (errors.length || during.includes("errore") || outcome.runs.length !== 2 || outcome.runs.some((run) => run.status !== "completa") || outcome.segments.length !== 2 || requests.filter((method) => method === "POST").length !== 2) process.exitCode = 1;
} finally { await browser.close(); }
