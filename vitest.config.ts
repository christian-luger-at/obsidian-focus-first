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
			// Keep every file well-covered (checked per file so no single file can
			// silently regress): 85% statements/lines, 80% branches/functions.
			thresholds: {
				perFile: true,
				statements: 85,
				lines: 85,
				branches: 80,
				functions: 80,
			},
		},
	},
});
