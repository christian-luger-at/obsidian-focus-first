// Generates a shields-style "coverage" badge SVG from vitest's coverage summary.
// Self-contained (no external service or dependency). Usage:
//   node scripts/coverage-badge.mjs [output.svg]
import { readFileSync, writeFileSync } from 'node:fs';

const outPath = process.argv[2] ?? 'coverage.svg';
const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
const pct = Math.round(summary.total.lines.pct);
const value = `${pct}%`;
const label = 'coverage';

const color =
	pct >= 90 ? '#4c1' :
	pct >= 80 ? '#97ca00' :
	pct >= 70 ? '#a4a61d' :
	pct >= 60 ? '#dfb317' :
	pct >= 50 ? '#fe7d37' : '#e05d44';

// Rough width estimate (~7px/char + padding) — good enough for a flat badge.
const labelW = 61;
const valueW = value.length * 8 + 12;
const totalW = labelW + valueW;
const labelMid = labelW * 5;
const valueMid = (labelW + valueW / 2) * 10;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#555"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${color}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text x="${labelMid}" y="150" transform="scale(.1)" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelMid}" y="140" transform="scale(.1)">${label}</text>
    <text x="${valueMid}" y="150" transform="scale(.1)" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${valueMid}" y="140" transform="scale(.1)">${value}</text>
  </g>
</svg>
`;

writeFileSync(outPath, svg);
console.log(`Wrote ${outPath}: ${label} ${value}`);
