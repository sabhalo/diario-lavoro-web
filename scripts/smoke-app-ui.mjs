import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext(), page = await context.newPage();
  const errors = [];
  const asrRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.url().includes("huggingface.co") || request.url().includes(":8765/asr")) asrRequests.push(request.url()); });
  await page.addInitScript(() => { window.showDirectoryPicker = async () => navigator.storage.getDirectory(); });
  await page.goto("http://127.0.0.1:4173/");
  await page.getByRole("button", { name: "Scegli un’altra cartella" }).click();
  await page.getByRole("button", { name: "Nuova sessione" }).first().click();
  await page.locator('input[name="title"]').fill("Prova ASR UI");
  await page.getByRole("button", { name: "Crea", exact: true }).click();
  await page.getByRole("heading", { name: "Trascrizione locale" }).waitFor();
  const browserTier = await page.locator("#asr-tier").inputValue();
  await page.locator("#asr-path").selectOption("local");
  const endpoint = await page.locator("#asr-url").inputValue();
  await page.locator("#asr-path").selectOption("browser");
  const disabledMaximum = await page.locator('#asr-tier option[value="massima"]').getAttribute("disabled") !== null;
  const second = await context.newPage(); await second.goto("http://127.0.0.1:4173/");
  const secondBlocked = await second.getByRole("heading", { name: "Archivio già aperto" }).isVisible();
  const blockedControls = await second.locator("#new-session").isDisabled();
  console.log(JSON.stringify({ browserTier, endpoint, disabledMaximum, secondBlocked, blockedControls, asrRequests, errors }));
  if (errors.length || asrRequests.length || browserTier !== "rapido" || endpoint !== "http://127.0.0.1:8765/asr" || !disabledMaximum || !secondBlocked || !blockedControls) process.exitCode = 1;
} finally { await browser.close(); }
