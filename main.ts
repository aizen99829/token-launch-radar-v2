// Token launch radar (token-radar-01 entry, Node 22, standard library only).
//
// V2 uses size-adjusted, winsorised peer ratios shrunk toward the global median,
// with middle-half value bands, confidence tiers and leave-one-out validation.
// Reads the sealed DefiLlama snapshot, scores every pre-token protocol with
// the model in lib/model.ts, writes the ranked board to board.json, writes
// the dashboard's data as data.js beside the page, copies dashboard/ and
// screenshots/ into the output, and finishes with dossier.json, built by the
// vendored make.fun library from exactly what was written.
//
// Locations: the snapshot is /input/snapshot.json in the grader, or
// --input <file|dir> elsewhere; the output is /output in the grader, or
// MAKEFUN_OUTPUT_DIR / --output elsewhere:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// The output directory is never deleted or renamed — only the files this
// program owns inside it are (re)written, so a second run over the same
// output writes the same bytes as the first.

import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The dossier caps the gate rebuilds with: the text cap shapes the bytes, the rest only refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAPS = { max_files: 400, max_bytes: 4_194_304 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> or --name=<value> out of the arguments, or the fallback. */
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
if (!existsSync(inputFile)) fail(`no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input`);
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const radar = buildRadar(snapshot);
const issue = boardIssue(radar.rows, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: radar.rows })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/**
 * Copy one directory's regular files into `to`, skipping names that start
 * with a dot, and remove files inside `to` that the source no longer holds:
 * a re-run over a used output must still write the dossier of exactly this
 * dashboard, never of a stale file left behind. Only entries inside `to`
 * are touched — never `to` itself, and never the output directory.
 */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    const dest = join(to, name);
    // copyFileSync gives a new destination the source's mode, and the
    // repository may be mounted with read-only modes: normalise the
    // destination before and after copying, or the second run over the
    // same output cannot overwrite the first run's files.
    if (existsSync(dest)) chmodSync(dest, 0o644);
    copyFileSync(path, dest);
    chmodSync(dest, 0o644);
    copied.push(name);
  }
  for (const name of readdirSync(to)) {
    if (!copied.includes(name) && statSync(join(to, name)).isFile()) rmSync(join(to, name));
  }
  return copied;
}

const dashFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
if (!dashFiles.includes('index.html')) fail('dashboard/ holds no index.html');
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length !== 3) fail(`screenshots/ holds ${shots.length} images: hand in exactly 3, the board, a detail view and a filtered view`);
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
}

// The dossier is written last: the scorer rebuilds it from this output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: DASHBOARD_CAPS }));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols scanned, ${snapshot.watchlist.length} on the watchlist, ` +
  `${radar.rows.length} rows ranked (${radar.pre_token_rows} pre-token, ${radar.launched_rows} launched anchors)\n` +
  `token radar: wrote board.json, data.js, dashboard/ (${dashFiles.length} files), screenshots/ (${shots.length} images) and dossier.json under ${out}\n` +
  `token radar: self-check on ${radar.validation.n} launched protocols: median error x${(10 ** radar.validation.model.median_abs_log10).toFixed(1)} vs baseline x${(10 ** radar.validation.baseline.median_abs_log10).toFixed(1)} (leave-one-out)\n`,
);
