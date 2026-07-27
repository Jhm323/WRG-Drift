#!/usr/bin/env node
// Engine-only driver for apps/web/src/game (Phase 4+): boots just the Vite
// dev server, drives apps/web/test.html — no API, no auth. Proves the
// canvas game actually renders and responds to keyboard input: idle
// (zero-key) baseline, active steered play, a forced straight-line crash,
// and a track switch.

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

  // 1. Idle baseline — no key ever pressed, so the car sits still and the
  // timer never starts. If this ever shows nonzero score/time, the "car
  // waits for first keydown" rule has regressed.
  {
    const { page, errors } = await freshPage(browser);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas');
    await page.waitForTimeout(2000);
    const scoreText = await page.textContent('#score');
    const timeText = await page.textContent('#time');
    step('idle (no keys) run does not start the timer', scoreText === '0' && timeText === '0.0s', `score=${scoreText}, time=${timeText}`);
    step('no console errors on idle run', errors.length === 0, JSON.stringify(errors));
    await page.screenshot({ path: `${SHOT_DIR}/1-idle.png` });
    await page.close();
  }

  // 2. Active steered play — alternating left/right taps to hug the curve
  // should survive for a while and accumulate score.
  {
    const { page, errors } = await freshPage(browser);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(220);
    await page.keyboard.up('ArrowRight');
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(180);
      await page.keyboard.up('ArrowRight');
      await page.waitForTimeout(120);
    }
    const scoreText = await page.textContent('#score');
    const timeText = await page.textContent('#time');
    step(
      'steered play survives and scores points',
      Number(scoreText) > 0 && parseFloat(timeText) > 1,
      `score=${scoreText}, time=${timeText}`,
    );
    step('no console errors during active play', errors.length === 0, JSON.stringify(errors));
    await page.screenshot({ path: `${SHOT_DIR}/2-active-play.png` });
    await page.close();
  }

  // 3. Straight-line crash — start, then release every key so the car
  // drives dead straight off a curving track and leaves the ribbon.
  {
    const { page, errors } = await freshPage(browser);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(30);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(6000);
    const statusText = await page.textContent('#status');
    step('driving straight off a curve crashes the run', statusText.startsWith('Crashed'), statusText);
    step('no console errors on crash', errors.length === 0, JSON.stringify(errors));
    await page.screenshot({ path: `${SHOT_DIR}/3-crashed.png` });
    await page.close();
  }

  // 4. Track switch — dropdown restarts the run on the new track, back to
  // idle zero score/time.
  {
    const { page, errors } = await freshPage(browser);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowRight');
    await page.selectOption('#track-select', 'switchback-canyon');
    await page.waitForTimeout(500);
    const scoreText = await page.textContent('#score');
    const timeText = await page.textContent('#time');
    step('track switch restarts on the new track', scoreText === '0' && timeText === '0.0s', `score=${scoreText}, time=${timeText}`);
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
