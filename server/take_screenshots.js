import puppeteer from 'puppeteer-core';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './src/app.js';
import { setupSocketIO } from './src/socket.js';
import { runMigrations } from './src/db/migrate.js';
import { runSeed } from './src/db/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function capture() {
  console.log('🌸 Initializing server for screenshots and multi-user verification...');
  await runMigrations();
  const seedData = await runSeed();

  const app = createApp();
  const server = http.createServer(app);
  setupSocketIO(server);

  await new Promise((resolve) => server.listen(5000, resolve));
  console.log('Server running on http://localhost:5000');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const screenshotsDir = path.resolve(__dirname, '../screenshots');

  async function loginUser(page, email, password = 'Password123!') {
    await page.goto('http://localhost:5000/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.startsWith('/boards'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 600));
  }

  // --- 1. Viewport: 1440px Desktop ---
  console.log('Capturing 1440px desktop...');
  const page1440 = await browser.newPage();
  await page1440.setViewport({ width: 1440, height: 900 });
  await loginUser(page1440, 'admin@kawaii.local');
  await page1440.goto(`http://localhost:5000/boards/${seedData.boardId}`, { waitUntil: 'domcontentloaded' });
  await page1440.waitForSelector('h4', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));
  await page1440.screenshot({ path: path.join(screenshotsDir, 'screenshot_1440px_desktop.png') });
  console.log('✓ 1440px desktop captured');

  // --- 2. Viewport: 1024px Laptop/Desktop ---
  console.log('Capturing 1024px desktop...');
  const page1024 = await browser.newPage();
  await page1024.setViewport({ width: 1024, height: 768 });
  await loginUser(page1024, 'admin@kawaii.local');
  await page1024.goto(`http://localhost:5000/boards/${seedData.boardId}`, { waitUntil: 'domcontentloaded' });
  await page1024.waitForSelector('h4', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  await page1024.screenshot({ path: path.join(screenshotsDir, 'screenshot_1024px_desktop.png') });
  console.log('✓ 1024px desktop captured');

  // --- 3. Viewport: 768px Tablet ---
  console.log('Capturing 768px tablet...');
  const page768 = await browser.newPage();
  await page768.setViewport({ width: 768, height: 1024 });
  await loginUser(page768, 'member@kawaii.local');
  await page768.goto(`http://localhost:5000/boards/${seedData.boardId}`, { waitUntil: 'domcontentloaded' });
  await page768.waitForSelector('h4', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  await page768.screenshot({ path: path.join(screenshotsDir, 'screenshot_768px_tablet.png') });
  console.log('✓ 768px tablet captured');

  // --- 4. Viewport: 375px Mobile ---
  console.log('Capturing 375px mobile...');
  const page375 = await browser.newPage();
  await page375.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  await loginUser(page375, 'viewer@kawaii.local');
  await page375.goto(`http://localhost:5000/boards/${seedData.boardId}`, { waitUntil: 'domcontentloaded' });
  await page375.waitForSelector('h4', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  await page375.screenshot({ path: path.join(screenshotsDir, 'screenshot_375px_mobile.png') });
  console.log('✓ 375px mobile captured');

  // --- 5. Viewport: 320px Ultra-Compact Mobile ---
  console.log('Capturing 320px mobile...');
  const page320 = await browser.newPage();
  await page320.setViewport({ width: 320, height: 568, isMobile: true, hasTouch: true });
  await page320.goto('http://localhost:5000/login', { waitUntil: 'domcontentloaded' });
  await page320.waitForSelector('input[type="email"]', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  await page320.screenshot({ path: path.join(screenshotsDir, 'screenshot_320px_mobile.png') });
  console.log('✓ 320px mobile captured');

  // --- 6. Concurrency Conflict Demonstration ---
  console.log('Demonstrating 409 Concurrency Conflict between 2 simultaneous users...');
  const adminPage = await browser.newPage();
  await adminPage.setViewport({ width: 1280, height: 800 });
  await loginUser(adminPage, 'admin@kawaii.local');
  await adminPage.goto(`http://localhost:5000/boards/${seedData.boardId}`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForSelector('h4', { timeout: 10000 });

  // Admin clicks first task to open details modal
  const firstTaskCard = await adminPage.$('h4');
  await firstTaskCard.click();
  await adminPage.waitForSelector('input[placeholder="Task title..."]', { timeout: 10000 });

  // Concurrently in the background, another user updates this task to advance its version
  const memberPage = await browser.newPage();
  await loginUser(memberPage, 'member@kawaii.local');
  const memberToken = await memberPage.evaluate(() => localStorage.getItem('kawaii_token'));

  // Get current task ID and version
  const tasksRes = await fetch(`http://localhost:5000/api/tasks?boardId=${seedData.boardId}`, {
    headers: { Authorization: `Bearer ${memberToken}` }
  });
  const tasksData = await tasksRes.json();
  const currentFirstTask = tasksData.tasks[0];

  console.log(`Member updating task ${currentFirstTask.id} from v${currentFirstTask.version}...`);
  await fetch(`http://localhost:5000/api/tasks/${currentFirstTask.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${memberToken}`
    },
    body: JSON.stringify({
      expectedVersion: currentFirstTask.version,
      priority: 'urgent',
    })
  });

  // Now Admin edits title and clicks Save Changes (sending stale expectedVersion)
  console.log('Admin clicking Save Changes with stale expectedVersion...');
  await adminPage.type('input[placeholder="Task title..."]', ' [Edited by Admin]');
  
  // Click Save button
  const buttons = await adminPage.$$('button');
  for (const b of buttons) {
    const text = await b.evaluate(el => el.textContent);
    if (text.includes('Save Changes')) {
      await b.click();
      break;
    }
  }

  // Wait for 409 conflict toast to appear
  await adminPage.waitForSelector('div[role="alert"]', { timeout: 8000 });
  await new Promise(r => setTimeout(r, 600));

  await adminPage.screenshot({ path: path.join(screenshotsDir, 'screenshot_concurrency_conflict.png') });
  console.log('✓ Concurrency conflict toast captured!');

  await browser.close();
  await new Promise(resolve => server.close(resolve));
  console.log('🌸 All screenshots and live verification passed successfully!');
  process.exit(0);
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});

