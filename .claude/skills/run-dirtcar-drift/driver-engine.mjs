#!/usr/bin/env node
// Engine-only driver for apps/web/src/game (Phase 4+): boots just the Vite
// dev server, drives apps/web/test.html — no API, no auth. Proves the
// canvas game actually renders and responds to clicks: idle (zero-click)
// baseline, active play, a forced crash, and a track switch.

import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { openSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const WEB_DIR = path.join(REPO_ROOT, 'apps/web');
const WEB_PORT = 5173;
const WEB_LOG = '/tmp/dirtcar-drift-web.log';
const SHOT_DIR = '/tmp/dirtcar-drift-engine-shots';

let failed = false;
let webChild = null;

function step(name, ok, extra = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed = true;
}

function killPort(port) {
  try {
    const pids = execSync(`lsof -ti:${port} -sTCP:LISTEN`).toString().trim();
    if (pids) execSync(`kill ${pids.split('\n').join(' ')}`);
  } catch {
    // nothing listening — fine
  }
}

async function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function cleanup() {
  try {
    webChild?.kill();
  } catch {
    // already dead
  }
  killPort(WEB_PORT);
}

async function freshPage(browser) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return { page, errors };
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true });
  killPort(WEB_PORT);

  const fd = openSync(WEB_LOG, 'w');
  webChild = spawn('npm', ['run', 'dev'], { cwd: WEB_DIR, stdio: ['ignore', fd, fd] });

  const webUp = await waitForHttp(`http://localhost:${WEB_PORT}`);
  step('web boots', webUp);
  if (!webUp) {
    console.error(`Check ${WEB_LOG} for errors.`);
    cleanup();
    process.exit(1);
  }

  const browser = await chromium.launch();
  const url = `http://localhost:${WEB_PORT}/test.html`;

  // 1. Idle baseline — gates are off-centerline (slalom), so zero clicks
  // should clear few or none. If this ever shows a high clear count, the
  // gate placement has regressed back to sitting on the centerline.
  {
    const { page, errors } = await freshPage(browser);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas');
    await page.waitForTimeout(3000);
    const gatesText = await page.textContent('#gates');
    step('idle (zero-click) run does not auto-clear gates', /^[0-2]\//.test(gatesText), gatesText);
    step('no console errors on idle run', errors.length === 0, JSON.stringify(errors));
    await page.screenshot({ path: `${SHOT_DIR}/1-idle.png` });
    await page.close();
  }

  // 2. Active play — steady clicks should clear gates and accumulate score.
  {
    const { page, errors } = await freshPage(browser);
    await page.goto(url, { waitUntil: 'networkidle' });
    const canvas = await page.waitForSelector('canvas');
    const box = await canvas.boundingBox();
    for (let i = 0; i < 14; i += 1) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(650);
    }
    const gatesText = await page.textContent('#gates');
    const scoreText = await page.textContent('#score');
    const clearedCount = Number(gatesText.split('/')[0]);
    step('clicking clears gates and scores points', clearedCount > 0 && Number(scoreText) > 0, `${gatesText}, score=${scoreText}`);
    step('no console errors during active play', errors.length === 0, JSON.stringify(errors));
    await page.screenshot({ path: `${SHOT_DIR}/2-active-play.png` });
    await page.close();
  }

  // 3. Spam-clicking should overcorrect and crash.
  {
    const { page, errors } = await freshPage(browser);
    await page.goto(url, { waitUntil: 'networkidle' });
    const canvas = await page.waitForSelector('canvas');
    const box = await canvas.boundingBox();
    for (let i = 0; i < 20; i += 1) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(500);
    const statusText = await page.textContent('#status');
    step('spam-clicking crashes the run', statusText.startsWith('Crashed'), statusText);
    step('no console errors on crash', errors.length === 0, JSON.stringify(errors));
    await page.screenshot({ path: `${SHOT_DIR}/3-crashed.png` });
    await page.close();
  }

  // 4. Track switch — dropdown restarts the run on the new track.
  {
    const { page, errors } = await freshPage(browser);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas');
    await page.selectOption('#track-select', 'switchback-canyon');
    await page.waitForTimeout(1000);
    const gatesText = await page.textContent('#gates');
    step('track switch restarts on the new track', gatesText.endsWith('/18'), gatesText);
    step('no console errors on track switch', errors.length === 0, JSON.stringify(errors));
    await page.screenshot({ path: `${SHOT_DIR}/4-switchback.png` });
    await page.close();
  }

  await browser.close();
  console.log(`Screenshots: ${SHOT_DIR}`);
  cleanup();
  process.exit(failed ? 1 : 0);
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

main().catch((err) => {
  console.error(err);
  cleanup();
  process.exit(1);
});
