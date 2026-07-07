import { defineConfig } from 'vitest/config';
// This is a Node-run config file (not shipped plugin code), so the Node builtin is fine.
// eslint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from 'node:url';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/tests/**/*.test.ts'],
		alias: {
			// Resolve relative to this config so it works on any machine / in CI.
			obsidian: fileURLToPath(new URL('./src/tests/__mocks__/obsidian.ts', import.meta.url)),
		},
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/tests/**'],
			all: true,
			// text: console report; json-summary: consumed by the coverage badge CI.
			reporter: ['text', 'json-summary'],
			// Keep every file above 85% statement/line coverage (checked per file so
			// no single file can silently regress). Branches/functions are not gated:
			// some files have defensive branches that are impractical to exercise.
			thresholds: {
				perFile: true,
				statements: 85,
				lines: 85,
			},
		},
	},
});
