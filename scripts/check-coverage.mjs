#!/usr/bin/env node
// Lists test case IDs from docs/test-cases.md that are missing from either API suite.
//
//   node scripts/check-coverage.mjs                 # check both suites
//   node scripts/check-coverage.mjs playwright      # check one suite (playwright | java)
//
// A case counts as covered when its ID (e.g. "AUTH-003") appears in a test file of the suite.
// Cases tagged "manual" in the catalog are not expected to be automated.
// IDs found in a suite that do NOT exist in the catalog are reported too (typos).
// Exit code 1 if anything is missing or unknown.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SUITES = {
  playwright: { dir: 'tests/api-playwright/tests', extension: '.ts' },
  java: { dir: 'tests/api-java/src/test', extension: '.java' },
};

// 1. Catalog: rows that start with "| ID |". The last column is the tag.
const catalog = new Map(); // id → tag
for (const line of fs.readFileSync(path.join(root, 'docs/test-cases.md'), 'utf8').split('\n')) {
  const match = line.match(/^\| ([A-Z]+-\d{3}) \|.*\| (\w+) \|\s*$/);
  if (match) catalog.set(match[1], match[2]);
}
const automated = [...catalog].filter(([, tag]) => tag !== 'manual').map(([id]) => id);

// 2. IDs referenced in a suite's test files
function filesIn(dir, extension) {
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir, { recursive: true })
    .map((f) => path.join(dir, f))
    .filter((f) => f.endsWith(extension) && fs.statSync(f).isFile());
}

const requested = process.argv[2];
const suiteNames = requested ? [requested] : Object.keys(SUITES);
let problems = 0;

console.log(`Catalog: ${catalog.size} cases (${automated.length} automated, ${catalog.size - automated.length} manual)\n`);

for (const name of suiteNames) {
  const suite = SUITES[name];
  if (!suite) {
    console.error(`Unknown suite "${name}". Use: ${Object.keys(SUITES).join(', ')}`);
    process.exit(2);
  }
  const files = filesIn(path.join(root, suite.dir), suite.extension);
  if (!files) {
    console.log(`✗ ${name}: folder ${suite.dir} not found — all ${automated.length} cases missing`);
    problems++;
    continue;
  }
  const found = new Set();
  for (const file of files) {
    for (const id of fs.readFileSync(file, 'utf8').match(/\b[A-Z]+-\d{3}\b/g) ?? []) found.add(id);
  }
  const missing = automated.filter((id) => !found.has(id));
  const unknown = [...found].filter((id) => !catalog.has(id)).sort();

  const covered = automated.length - missing.length;
  console.log(`${missing.length || unknown.length ? '✗' : '✓'} ${name}: ${covered}/${automated.length} catalog cases covered`);
  if (missing.length) console.log(`  missing: ${missing.join(', ')}`);
  if (unknown.length) console.log(`  not in catalog: ${unknown.join(', ')}`);
  problems += missing.length + unknown.length;
}

process.exit(problems ? 1 : 0);
