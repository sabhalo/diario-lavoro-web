import { spawn } from "node:child_process";

const python = process.platform === "win32" ? "python" : "python3";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isDiaryServer = async () => { try { const response = await fetch("http://127.0.0.1:4173/index.html", { cache: "no-store" }); return response.ok && (await response.text()).includes("<title>Diario di lavoro</title>"); } catch { return false; } };
let server = null, serverError = null, serverExit = null;
try {
  if (await isDiaryServer()) console.log("Riutilizzo il server Diario già attivo su 127.0.0.1:4173.");
  else {
    server = spawn(python, ["-m", "http.server", "4173", "--bind", "127.0.0.1"], { cwd: process.cwd(), stdio: "ignore", windowsHide: true });
    server.on("error", (error) => { serverError = error; }); server.on("exit", (code) => { serverExit = code; });
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      if (serverError) throw serverError;
      if (serverExit !== null) throw new Error(`Server statico terminato con codice ${serverExit}. Porta 4173 occupata o Python non disponibile.`);
      if (await isDiaryServer()) { ready = true; break; }
      await wait(200);
    }
    if (!ready) throw new Error("Server statico non pronto su 127.0.0.1:4173.");
  }
  const checks = process.argv.includes("--maximum") ? [["benchmark-browser-maximum.mjs"]]
    : process.argv.includes("--browser-model") ? [["smoke-asr-browser.mjs", "--browser-model", ...(process.argv.includes("--balanced") ? ["--balanced"] : [])]]
    : [["smoke-app-ui.mjs"], ["smoke-asr-browser.mjs", "--slow"], ["smoke-archive-export.mjs"]];
  for (const [script, ...args] of checks) {
    const code = await new Promise((resolve, reject) => { const child = spawn(process.execPath, [`scripts/${script}`, ...args], { stdio: "inherit", windowsHide: true }); child.on("error", reject); child.on("exit", (exitCode) => resolve(exitCode)); });
    if (code !== 0) throw new Error(`${script} fallito con codice ${code}.`);
  }
} finally { server?.kill(); }
