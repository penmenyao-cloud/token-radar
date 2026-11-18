// Token Radar: a program that turns the sealed protocol snapshot into a ranked board,
// a static dashboard and the dossier the judge reads.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// The snapshot comes from --input <snapshot.json|directory>, else /input/snapshot.json. The
// outputs go to --output <dir>, else $MAKEFUN_OUTPUT_DIR, else /output. Everything is
// deterministic: the same snapshot bytes always write the same output bytes.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The dossier's text cap: the dashboard's source the judge reads fits in 65,536 bytes. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

function fail(message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(1);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dashboardFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));

/**
 * Fail fast when a dashboard file names a network address where the gate refuses one:
 * any http(s) address in a CSS file, in an HTML attribute value or <style> body, or in a
 * JavaScript import, export-from, require or dynamic-import specifier. Visible text and
 * comments may carry URLs, so only those positions are checked.
 */
function checkDashboardOffline(dir: string, files: string[]): void {
  for (const name of files) {
    const text = readFileSync(join(dir, name), 'utf8');
    if (name.endsWith('.css')) {
      if (/https?:\/\//.test(text)) fail(`dashboard/${name}: a CSS file names a network address`);
    } else if (name.endsWith('.html')) {
      if (/=\s*["']https?:\/\//.test(text)) fail(`dashboard/${name}: an HTML attribute names a network address`);
      for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
        if (/https?:\/\//.test(m[1]!)) fail(`dashboard/${name}: a <style> body names a network address`);
      }
    } else if (name.endsWith('.js') || name.endsWith('.mjs')) {
      if (/(?:import\s+(?:[^'"]*?\sfrom\s*)?|export\s+[^'"]*?\sfrom\s*|require\s*\(\s*|import\s*\(\s*)['"]https?:\/\//.test(text)) {
        fail(`dashboard/${name}: a JavaScript import names a network address`);
      }
    }
  }
}
checkDashboardOffline(join(out, 'dashboard'), dashboardFiles);
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
}

// The dossier is written last: the scorer rebuilds it from this output directory and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashboardFiles.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
