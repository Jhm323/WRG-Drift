#!/usr/bin/env node
// Full-stack driver for DirtCar Drift: boots apps/api + apps/web, drives the
// signup -> verify -> login -> nav -> logout flow in headless Chromium, and
// screenshots each step. See SKILL.md in this directory for usage.

import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { existsSync, openSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const API_DIR = path.join(REPO_ROOT, 'apps/api');
const WEB_DIR = path.join(REPO_ROOT, 'apps/web');
const API_PORT = 4000;
const WEB_PORT = 5173;
const API_LOG = '/tmp/dirtcar-drift-api.log';
const WEB_LOG = '/tmp/dirtcar-drift-web.log';
const SHOT_DIR = '/tmp/dirtcar-drift-shots';

const children = [];
let failed = false;

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

function spawnLogged(cmd, args, cwd, logFile) {
  const fd = openSync(logFile, 'w');
  const child = spawn(cmd, args, { cwd, stdio: ['ignore', fd, fd] });
  children.push(child);
  return child;
}

function cleanup() {
  for (const child of children) {
    try {
      child.kill();
    } catch {
      // already dead
    }
  }
  killPort(API_PORT);
  killPort(WEB_PORT);
}

async function main() {
  if (!existsSync(path.join(API_DIR, '.env'))) {
    console.error(`Missing ${API_DIR}/.env — see SKILL.md Setup section.`);
    process.exit(1);
  }

  await mkdir(SHOT_DIR, { recursive: true });
  killPort(API_PORT);
  killPort(WEB_PORT);

  spawnLogged('node', ['server.js'], API_DIR, API_LOG);
  spawnLogged('npm', ['run', 'dev'], WEB_DIR, WEB_LOG);

  const apiUp = await waitForHttp(`http://localhost:${API_PORT}/health`);
  step('api boots', apiUp);
  const webUp = await waitForHttp(`http://localhost:${WEB_PORT}`);
  step('web boots', webUp);

  if (!apiUp || !webUp) {
    console.error(`Check ${API_LOG} / ${WEB_LOG} for errors.`);
    cleanup();
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const email = `driver.${Date.now()}@dirtcar.com`;
  const password = 'password123';

  try {
    // Route guard: unauthenticated visit to a protected route bounces to /login
    await page.goto(`http://localhost:${WEB_PORT}/tracks`, { waitUntil: 'networkidle' });
    await page.waitForURL('**/login', { timeout: 10000 });
    step('route guard redirects to /login', true);
    await page.screenshot({ path: `${SHOT_DIR}/1-login.png` });

    // Signup with an avatar pick
    await page.goto(`http://localhost:${WEB_PORT}/signup`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="text"]', 'Driver Bot');
    await page.fill('input[type="password"]', password);
    await page.click('.avatar-picker__option:nth-child(3)');
    await page.screenshot({ path: `${SHOT_DIR}/2-signup-filled.png` });
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Check your inbox', { timeout: 10000 });
    step('signup succeeds', true);

    // Verification link comes from the API's console log (RESEND_API_KEY unset in dev)
    const log = await readFile(API_LOG, 'utf8');
    const matches = log.match(/http:\/\/localhost:4000\/auth\/verify\?token=[a-f0-9]+/g);
    const verifyLink = matches?.at(-1);
    step('verification link found in API log', Boolean(verifyLink));
    if (verifyLink) {
      const verifyResp = await page.request.get(verifyLink);
      step('verify link resolves', verifyResp.ok(), `HTTP ${verifyResp.status()}`);
    }

    // Login
    await page.goto(`http://localhost:${WEB_PORT}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/tracks', { timeout: 10000 });
    await page.waitForSelector('.app-header__name', { timeout: 10000 });
    step('login redirects to /tracks with session', true);
    await page.screenshot({ path: `${SHOT_DIR}/3-tracks-loggedin.png` });

    // Nav + logout
    await page.click('a:has-text("Leaderboard")');
    await page.waitForURL('**/leaderboard', { timeout: 10000 });
    step('nav to /leaderboard works', true);
    await page.screenshot({ path: `${SHOT_DIR}/4-leaderboard.png` });

    await page.click('button:has-text("Log out")');
    await page.waitForURL('**/login', { timeout: 10000 });
    step('logout redirects to /login', true);

    await page.goto(`http://localhost:${WEB_PORT}/tracks`, { waitUntil: 'networkidle' });
    await page.waitForURL('**/login', { timeout: 10000 });
    step('session actually cleared (guard re-fires)', true);
  } catch (err) {
    step('flow completed without throwing', false, err.message);
    await page.screenshot({ path: `${SHOT_DIR}/error.png` }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log(`Screenshots: ${SHOT_DIR}`);
  console.log(`Console errors seen: ${consoleErrors.length} (401s from the pre-login /auth/me check are expected)`);

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
