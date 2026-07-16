#!/usr/bin/env node
/**
 * Automated documentation screenshots.
 *
 * Drives the real Obsidian app over the Chrome DevTools Protocol: it builds a
 * small, curated screenshot vault, launches Obsidian against it with remote
 * debugging enabled, opens the Focus First view, and captures each motif in
 * light and dark themes into docs/public/screens/.
 *
 * Usage:
 *   node scripts/screenshots.mjs              # requires Obsidian to be closed
 *   node scripts/screenshots.mjs --quit       # quit a running Obsidian first
 *
 * Obsidian's own config (obsidian.json) is backed up and restored, so your
 * normal vault setup is left exactly as it was.
 */
import { chromium } from 'playwright-core';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, copyFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const REPO = resolve(process.cwd());
const VAULT = join(REPO, '.screenshot-vault');
const OUT = join(REPO, 'docs/public/screens');
const PORT = 9222;
const OBSIDIAN = '/Applications/Obsidian.app/Contents/MacOS/Obsidian';
const CONFIG = join(homedir(), 'Library/Application Support/obsidian/obsidian.json');
const BACKUP = `${CONFIG}.focus-first-backup`;
const QUIT = process.argv.includes('--quit');

const log = (m) => console.log(`  ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (offset) => {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() + offset);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// 1. A small, curated vault: enough tasks to fill every quadrant, no clutter.
// ---------------------------------------------------------------------------
function buildVault() {
	rmSync(VAULT, { recursive: true, force: true });
	mkdirSync(join(VAULT, '.obsidian/plugins/focus-first'), { recursive: true });

	const notes = {
		'Work.md': `# Work

## Tasks
- [ ] Send the client proposal 🔺 📅 ${iso(0)} #s #focus
- [ ] Fix the checkout bug ⏫ 📅 ${iso(-1)} #m #focus
- [ ] Prepare the board deck 🔺 📅 ${iso(2)} #l #focus
- [ ] Draft the 2027 strategy ⏫ 📅 ${iso(21)} #l #highvalue
- [ ] Plan the team offsite ⏫ #m
- [ ] Reply to the vendor email 🔽 📅 ${iso(1)} #s
- [ ] Update the status spreadsheet ⏬ 📅 ${iso(1)} #s #lowvalue
- [ ] Reorganise the shared drive ⏬ #l #lowvalue
- [ ] Review the analytics dashboard 🔼 📅 ${iso(18)} #m
- [x] Ship the release notes ⏫ 📅 ${iso(-2)} #s ✅ ${iso(-2)}
`,
		'Personal.md': `# Personal

## Tasks
- [ ] Book the dentist appointment 🔼 📅 ${iso(3)} #s
- [ ] Renew the passport 🔺 📅 ${iso(25)} #m #highvalue
- [ ] Sort out the photo archive ⏬ #l
`,
		'Welcome.md': `# Focus First

A small demo vault used to generate the documentation screenshots.
`,
	};
	for (const [name, body] of Object.entries(notes)) writeFileSync(join(VAULT, name), body);

	// Copy (not symlink) the built plugin, so its data.json stays in the vault.
	for (const f of ['main.js', 'manifest.json', 'styles.css']) {
		copyFileSync(join(REPO, f), join(VAULT, '.obsidian/plugins/focus-first', f));
	}
	writeFileSync(join(VAULT, '.obsidian/community-plugins.json'), JSON.stringify(['focus-first']));
	// Pre-seed the settings we want on camera.
	writeFileSync(
		join(VAULT, '.obsidian/plugins/focus-first/data.json'),
		JSON.stringify({ focusTargetCount: 3, urgencyDays: 3 }, null, 2),
	);
	writeFileSync(join(VAULT, '.obsidian/app.json'), JSON.stringify({ promptDelete: false }));
	log(`vault ready: ${VAULT}`);
}

// ---------------------------------------------------------------------------
// 2. Point Obsidian at it (reversibly).
// ---------------------------------------------------------------------------
function patchObsidianConfig() {
	copyFileSync(CONFIG, BACKUP);
	const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
	cfg.vaults ??= {};
	for (const v of Object.values(cfg.vaults)) v.open = false;
	cfg.vaults[randomBytes(8).toString('hex')] = { path: VAULT, ts: Date.now(), open: true };
	writeFileSync(CONFIG, JSON.stringify(cfg));
	log('obsidian.json patched (backup kept)');
}
function restoreObsidianConfig() {
	if (existsSync(BACKUP)) {
		copyFileSync(BACKUP, CONFIG);
		rmSync(BACKUP);
		log('obsidian.json restored');
	}
}

// ---------------------------------------------------------------------------
// 3. Launch + connect.
// ---------------------------------------------------------------------------
async function waitForCdp(timeoutMs = 30000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
			if (r.ok) return;
		} catch { /* not up yet */ }
		await sleep(400);
	}
	throw new Error(`Obsidian did not expose the debugging port ${PORT} in time.`);
}

async function obsidianPage(browser) {
	const deadline = Date.now() + 30000;
	while (Date.now() < deadline) {
		for (const ctx of browser.contexts()) {
			for (const p of ctx.pages()) {
				if (p.url().startsWith('app://')) {
					const ready = await p.evaluate(() => !!globalThis.app?.workspace?.layoutReady).catch(() => false);
					if (ready) return p;
				}
			}
		}
		await sleep(500);
	}
	throw new Error('Could not find a ready Obsidian window.');
}

/**
 * A fresh vault starts in restricted mode and may show a "trust author" dialog,
 * so the community plugin never loads. Dismiss the dialog, leave restricted
 * mode, and enable the plugin through Obsidian's own API, then wait for it.
 */
async function ensurePlugin(page) {
	await page.evaluate(async () => {
		// Best effort: accept the "trust author and enable plugins" dialog.
		const cta = document.querySelector('.modal .modal-button-container button.mod-cta');
		if (cta) cta.click();
		const P = globalThis.app.plugins;
		try { await P.setEnable?.(true); } catch { /* already enabled */ }
		try { await P.enablePluginAndSave?.('focus-first'); } catch { /* already enabled */ }
	});

	const deadline = Date.now() + 20000;
	while (Date.now() < deadline) {
		const state = await page.evaluate(() => {
			const P = globalThis.app.plugins;
			return {
				loaded: !!P.plugins['focus-first'],
				restricted: P.isEnabled ? !P.isEnabled() : null,
				enabled: [...(P.enabledPlugins ?? [])],
				modal: !!document.querySelector('.modal'),
			};
		});
		if (state.loaded) { log('plugin loaded'); return; }
		await sleep(500);
	}
	const state = await page.evaluate(() => {
		const P = globalThis.app.plugins;
		return JSON.stringify({
			enabled: [...(P.enabledPlugins ?? [])],
			modalText: document.querySelector('.modal')?.innerText?.slice(0, 200) ?? null,
		});
	});
	throw new Error(`focus-first did not load. Obsidian state: ${state}`);
}

// ---------------------------------------------------------------------------
// 4. The motifs.
// ---------------------------------------------------------------------------
async function setTheme(page, theme) {
	await page.evaluate((t) => {
		document.body.classList.toggle('theme-dark', t === 'dark');
		document.body.classList.toggle('theme-light', t === 'light');
	}, theme);
	await sleep(250);
}

async function configure(page, patch) {
	await page.evaluate(async (p) => {
		const plugin = globalThis.app.plugins.plugins['focus-first'];
		Object.assign(plugin.settings, p);
		await plugin.saveSettings();
		plugin.applyFontSize?.();
		plugin.refreshViews();
	}, patch);
	await sleep(600);
}

/**
 * Close any open hover popover. The physical mouse pointer sitting anywhere over
 * the Obsidian window makes it fire real hover events, which would otherwise
 * leave a popover open across unrelated shots.
 */
async function hidePopovers(page) {
	await page.evaluate(() => {
		document.querySelectorAll('.focus-first-task-detail.is-open')
			.forEach((el) => el.classList.remove('is-open'));
	});
}

async function shoot(page, name, theme, selector = '.focus-first-view', keepPopover = false) {
	if (!keepPopover) await hidePopovers(page);
	const file = join(OUT, `${name}-${theme}.png`);
	await page.locator(selector).first().screenshot({ path: file });
	log(`shot ${name}-${theme}.png`);
}

/** Escape any leftover dialog (trust prompt, restricted mode) before shooting. */
async function closeModals(page) {
	for (let i = 0; i < 6; i++) {
		const open = await page.evaluate(() => !!document.querySelector('.modal-container'));
		if (!open) return;
		await page.keyboard.press('Escape');
		await sleep(400);
	}
	log('warning: a dialog is still open');
}

/**
 * The plugin ships the view in the right sidebar. For documentation shots we
 * want it wide in the main pane, so the 2x2 grid reads as a grid.
 */
async function openViewWide(page) {
	await page.evaluate(async () => {
		const ws = globalThis.app.workspace;
		ws.leftSplit?.collapse?.();
		ws.rightSplit?.collapse?.();
		const leaf = ws.getLeaf(false);
		await leaf.setViewState({ type: 'focus-first-view', active: true });
		await ws.revealLeaf(leaf);
	});
	await page.waitForSelector('.focus-first-view', { timeout: 15000 });
}

async function capture(page) {
	mkdirSync(OUT, { recursive: true });

	// Readability is driven by the width alone: the docs render these at roughly
	// 690px wide, so a 1440px-wide shot would scale to ~48% and the UI text would
	// be unreadable. 900px scales to ~77%, and the plugin's font-size setting is
	// turned up so the text survives it. The height only has to be generous enough
	// that no quadrant scrolls internally and clips its tasks.
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Emulation.setDeviceMetricsOverride', {
		width: 900, height: 1000, deviceScaleFactor: 2, mobile: false,
	});
	await sleep(500);

	await closeModals(page);
	await openViewWide(page);
	// Bigger view font + no "Tasks plugin is not enabled" nudge in the docs.
	await configure(page, { tasksPluginWarningDismissed: true, axisMode: 'eisenhower', fontSize: 125 });
	await sleep(1200);

	for (const theme of ['light', 'dark']) {
		await setTheme(page, theme);

		await configure(page, { axisMode: 'eisenhower' });
		await shoot(page, 'eisenhower-matrix', theme);

		await configure(page, { axisMode: 'valueEffort' });
		await shoot(page, 'value-effort-matrix', theme);

		await configure(page, { axisMode: 'eisenhower' });
		await shoot(page, 'focus-list', theme, '.focus-first-focus-container');

		// Size filter: reveal the search area and tick "Small".
		await page.evaluate(() => {
			document.querySelector('.focus-first-search-toggle')?.click();
		});
		await sleep(400);
		await page.evaluate(() => {
			const boxes = [...document.querySelectorAll('.focus-first-size-filter-group input[type="checkbox"]')];
			if (boxes[0]) { boxes[0].checked = true; boxes[0].dispatchEvent(new Event('change')); }
		});
		await sleep(600);
		await shoot(page, 'size-filter', theme);
		// Reset the filter and close the search area again.
		await page.evaluate(() => {
			const boxes = [...document.querySelectorAll('.focus-first-size-filter-group input[type="checkbox"]')];
			if (boxes[0]) { boxes[0].checked = false; boxes[0].dispatchEvent(new Event('change')); }
			document.querySelector('.focus-first-search-toggle')?.click();
		});
		await sleep(400);

		// Detail popover: hover the first task row.
		const row = page.locator('.focus-first-matrix-container .focus-first-task-item').first();
		await row.hover();
		await sleep(900);
		await shoot(page, 'task-details', theme, '.focus-first-view', true);
		await page.mouse.move(0, 0);
		await sleep(400);
	}
}

/**
 * The Triage view (a separate view type) with a task's quadrant picker open. It
 * lives in the sidebar by default; for the shot we open it wide in the main pane
 * and hover the first row so its floating picker appears.
 */
async function captureTriage(page) {
	// Create the unclassified backlog now, after the matrix and tour shots, so
	// these bare tasks don't clutter the matrix's Eliminate quadrant. One is pinned
	// with #schedule so the picker's "already chosen" mark shows on another row.
	await page.evaluate(async () => {
		const { vault } = globalThis.app;
		const body = [
			'# Triage', '', '## Tasks',
			'- [ ] Archive last year\'s invoices',
			'- [ ] Assign the budget owners #schedule',
			'- [ ] Clean up the downloads folder',
			'- [ ] Research the new CRM tool', '',
		].join('\n');
		const existing = vault.getAbstractFileByPath('Triage.md');
		if (existing) await vault.modify(existing, body);
		else await vault.create('Triage.md', body);
	});
	await sleep(1500); // let the metadata cache index the new tasks

	await page.evaluate(async () => {
		const ws = globalThis.app.workspace;
		ws.leftSplit?.collapse?.();
		ws.rightSplit?.collapse?.();
		const leaf = ws.getLeaf(false);
		await leaf.setViewState({ type: 'focus-first-triage-view', active: true });
		await ws.revealLeaf(leaf);
	});
	await page.waitForSelector('.focus-first-triage-view .focus-first-triage-item', { timeout: 15000 });
	await sleep(800);

	for (const theme of ['light', 'dark']) {
		await setTheme(page, theme);
		await sleep(300);
		// Hover the first row; wireDetailHover opens the floating picker after a
		// short delay, so wait for it before shooting (keepPopover, so it stays).
		await page.locator('.focus-first-triage-view .focus-first-triage-item').first().hover();
		await sleep(900);
		await shoot(page, 'triage', theme, '.focus-first-triage-view', true);
		await page.mouse.move(0, 0);
		await sleep(400);
	}
}

/**
 * Records a short scripted tour as an animated GIF: hover a task for its
 * popover, switch the axes to Value/Effort and back, then filter to quick wins.
 *
 * Frames come from the CDP screencast (which only emits on visual change), so
 * each frame's real duration is preserved via ffmpeg's concat demuxer and dead
 * time is compressed automatically.
 */
async function recordTour(page) {
	const dir = join(VAULT, '.frames');
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });

	const cdp = await page.context().newCDPSession(page);
	// The GIF gets its own landscape canvas: it also serves as the hero image, and
	// the stills' tall 900x1000 canvas would make the hero awkwardly portrait. Wider
	// means shorter content, so a slightly smaller font still fits without clipping.
	await cdp.send('Emulation.setDeviceMetricsOverride', {
		width: 1200, height: 840, deviceScaleFactor: 2, mobile: false,
	});
	await sleep(600);

	const frames = [];
	cdp.on('Page.screencastFrame', async (f) => {
		frames.push({ buf: Buffer.from(f.data, 'base64'), ts: Date.now() });
		try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* stopped */ }
	});

	await hidePopovers(page);
	await setTheme(page, 'light');
	await configure(page, { axisMode: 'eisenhower', fontSize: 110 });
	await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1 });
	await sleep(1000);

	// 1. Hover a task to reveal the detail popover.
	await page.locator('.focus-first-matrix-container .focus-first-task-item').first().hover();
	await sleep(1800);
	await page.mouse.move(20, 400);
	await sleep(700);

	// 2. Switch the axes to Value/Effort and back.
	const setAxis = (mode) => page.evaluate((m) => {
		const s = document.querySelector('.focus-first-axis-select');
		s.value = m;
		s.dispatchEvent(new Event('change'));
	}, mode);
	await setAxis('valueEffort');
	await sleep(2000);
	await setAxis('eisenhower');
	await sleep(1200);

	// 3. Filter down to the quick wins.
	await page.evaluate(() => document.querySelector('.focus-first-search-toggle')?.click());
	await sleep(700);
	const toggleSmall = (on) => page.evaluate((v) => {
		const b = document.querySelector('.focus-first-size-filter-group input[type="checkbox"]');
		if (b) { b.checked = v; b.dispatchEvent(new Event('change')); }
	}, on);
	await toggleSmall(true);
	await sleep(1800);
	await toggleSmall(false);
	await sleep(600);
	await page.evaluate(() => document.querySelector('.focus-first-search-toggle')?.click());
	await sleep(900);

	await cdp.send('Page.stopScreencast');
	if (frames.length < 2) throw new Error('the screencast produced no frames');

	// Write frames plus a concat list that keeps the real timing.
	const lines = [];
	frames.forEach((f, i) => {
		const name = `f${String(i).padStart(5, '0')}.jpg`;
		writeFileSync(join(dir, name), f.buf);
		const next = frames[i + 1];
		const dur = next ? Math.min((next.ts - f.ts) / 1000, 2) : 0.8;
		lines.push(`file '${name}'`, `duration ${Math.max(dur, 0.04).toFixed(3)}`);
	});
	lines.push(`file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'`);
	writeFileSync(join(dir, 'list.txt'), lines.join('\n'));

	const gif = join(OUT, 'tour.gif');
	execFileSync('ffmpeg', [
		'-y', '-hide_banner', '-loglevel', 'error',
		'-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
		'-vf', 'fps=12,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
		'-loop', '0', gif,
	]);
	const kb = Math.round(readFileSync(gif).length / 1024);
	log(`recorded tour.gif from ${frames.length} frames (${kb} KB)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
let child;
try {
	if (!existsSync(OBSIDIAN)) throw new Error(`Obsidian not found at ${OBSIDIAN}`);
	for (const f of ['main.js', 'manifest.json', 'styles.css']) {
		if (!existsSync(join(REPO, f))) throw new Error(`${f} missing. Run "npm run build" first.`);
	}

	let running = false;
	try { execFileSync('pgrep', ['-x', 'Obsidian'], { stdio: 'ignore' }); running = true; } catch { /* not running */ }
	if (running) {
		if (!QUIT) {
			throw new Error(
				'Obsidian is running. Screenshots need it launched with a debugging port.\n' +
				'  Quit Obsidian and re-run, or pass --quit to close it automatically.',
			);
		}
		log('quitting the running Obsidian...');
		execFileSync('osascript', ['-e', 'quit app "Obsidian"']);
		await sleep(2500);
	}

	buildVault();
	patchObsidianConfig();

	log('launching Obsidian with remote debugging...');
	child = spawn(OBSIDIAN, [`--remote-debugging-port=${PORT}`], { detached: true, stdio: 'ignore' });
	await waitForCdp();

	const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
	const page = await obsidianPage(browser);
	log('connected to the Obsidian window');

	await ensurePlugin(page);
	await capture(page);
	await recordTour(page);
	await captureTriage(page);
	await browser.close();
	console.log(`\nScreenshots written to ${OUT}`);
} catch (err) {
	console.error(`\nScreenshot run failed: ${err.message}`);
	process.exitCode = 1;
} finally {
	try { execFileSync('osascript', ['-e', 'quit app "Obsidian"']); } catch { /* already gone */ }
	await sleep(1200);
	restoreObsidianConfig();
	child?.unref?.();
}
