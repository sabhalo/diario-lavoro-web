import { build } from "esbuild";
import { copyFile, readFile, writeFile } from "node:fs/promises";

await build({ entryPoints: ["src/browser-asr-entry.js"], bundle: true, minify: false, format: "esm", platform: "browser", outfile: "src/browser-asr.bundle.js" });
// The upstream architecture table contains a 32-character Mistral class name
// that GitHub mistakes for an API key. Keep its runtime value while splitting
// the static literal in the generated artifact.
const output = "src/browser-asr.bundle.js";
const bundle = await readFile(output, "utf8");
const className = '"Mistral3ForConditionalGeneration"';
if (bundle.split(className).length !== 2) throw new Error("Unexpected upstream Mistral class mapping; inspect the bundle before publication.");
await writeFile(output, bundle.replace(className, '"Mistral3For" + "ConditionalGeneration"'));
for (const extension of ["mjs", "wasm"]) {
  await copyFile(`node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.${extension}`, `src/ort-wasm-simd-threaded.asyncify.${extension}`);
}
