import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream"] });
try {
  const page = await browser.newPage();
  page.on("console", (message) => console.error("browser:", message.text()));
  await page.goto("http://127.0.0.1:4173/");
  const result = await page.evaluate(async (slow) => {
    const { audioWindows, contiguousMedia } = await import("/src/asr.js");
    const { FileArchive, MemoryDirectoryAdapter } = await import("/src/archive.js");
    const browserAsr = await import("/src/browser-asr.bundle.js");
    if (typeof browserAsr.loadWhisper !== "function") throw new Error("Bundle browser ASR non caricato");
    async function run(withVideo) {
      const audio = new AudioContext(), oscillator = audio.createOscillator(), destination = audio.createMediaStreamDestination();
      oscillator.frequency.value = 440; oscillator.connect(destination); oscillator.start();
      const canvas = document.createElement("canvas"); canvas.width = 16; canvas.height = 16;
      const context = canvas.getContext("2d"); let frame = 0;
      const ticker = setInterval(() => { context.fillStyle = frame++ % 2 ? "red" : "blue"; context.fillRect(0, 0, 16, 16); }, 100);
      const video = canvas.captureStream(10), stream = new MediaStream([...(withVideo ? video.getVideoTracks() : []), ...destination.stream.getAudioTracks()]);
      const recorder = new MediaRecorder(stream, { mimeType: withVideo ? "video/webm;codecs=vp8,opus" : "audio/webm;codecs=opus" }), blobs = [];
      recorder.ondataavailable = (event) => { if (event.data.size) blobs.push(event.data); };
      const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.start(500); await new Promise((resolve) => setTimeout(resolve, 2400)); recorder.stop(); await stopped;
      clearInterval(ticker); oscillator.stop(); await audio.close(); video.getTracks().forEach((track) => track.stop());
      const directory = new MemoryDirectoryAdapter(), archive = await FileArchive.open(directory);
      const chunks = [];
      for (let i = 0; i < blobs.length; i++) {
        const chunk = { id: `c${i}`, sessionId: "s1", recordingId: "r1", stream: withVideo ? "display" : "microfono", index: i, startMs: i * 500, endMs: (i + 1) * 500, format: recorder.mimeType };
        chunks.push(await archive.writeFragment(chunk, blobs[i]));
      }
      const media = contiguousMedia(chunks), windows = [];
      await Promise.race([ (async () => { for await (const window of audioWindows(archive, media, new AbortController().signal, { windowSamples: slow ? 8000 : 320_000 })) { windows.push({ samples: window.samples.length, peak: window.samples.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0), startMs: window.startMs, endMs: window.endMs }); if (slow) await new Promise((resolve) => setTimeout(resolve, 500)); } })(), new Promise((_, reject) => setTimeout(() => reject(new Error("audioWindows timed out")), 15000)) ]);
      return { chunks: chunks.length, mime: recorder.mimeType, windows };
    }
    return { video: await run(true), audio: await run(false) };
  }, process.argv.includes("--slow"));
  console.log(JSON.stringify(result));
  if ([result.video, result.audio].some((item) => !item.windows.length || !item.windows.some((window) => window.samples > 0 && window.peak > 0.1) || item.windows.reduce((sum, window) => sum + window.samples, 0) > 16_000 * 3)) process.exitCode = 1;
  if (process.argv.includes("--helper")) {
    const helper = await page.evaluate(async () => {
      const { preflightLocalAsr, transcribeLocal } = await import("/src/asr.js");
      const endpoint = await preflightLocalAsr("http://127.0.0.1:8765/asr");
      const wav = new DataView(await (await fetch("/test/fixtures/italiano-cc0-4000000037-16k.wav")).arrayBuffer());
      const samples = new Float32Array((wav.byteLength - 44) / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = wav.getInt16(44 + i * 2, true) / 32768;
      const response = await transcribeLocal(endpoint, samples, new AbortController().signal);
      return { model: endpoint.info.model, api: response.api, segments: response.segments.length, text: response.text };
    });
    console.log(JSON.stringify({ helper }));
  }
  if (process.argv.includes("--browser-model")) {
    const modelId = process.argv.includes("--balanced") ? "onnx-community/whisper-small" : "onnx-community/whisper-base";
    const model = await page.evaluate(async (modelId) => {
      const { loadWhisper } = await import("/src/browser-asr.bundle.js");
      const pipe = await loadWhisper(modelId, { device: "wasm", dtype: "q8" });
      const wav = new DataView(await (await fetch("/test/fixtures/italiano-cc0-4000000037-16k.wav")).arrayBuffer());
      const samples = new Float32Array((wav.byteLength - 44) / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = wav.getInt16(44 + i * 2, true) / 32768;
      const result = await pipe(samples, { language: "italian", task: "transcribe", return_timestamps: true });
      return result;
    }, modelId);
    console.log(JSON.stringify({ model }));
    await page.reload();
    await page.context().setOffline(true);
    const offline = await page.evaluate(async (modelId) => {
      const { loadWhisper } = await import("/src/browser-asr.bundle.js");
      const pipe = await loadWhisper(modelId, { device: "wasm", dtype: "q8" });
      return typeof pipe === "function";
    }, modelId);
    console.log(JSON.stringify({ offlineReloadFromCache: offline }));
  }
} finally { await browser.close(); }
