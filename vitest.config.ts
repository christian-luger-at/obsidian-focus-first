import { defineConfig } from 'vitest/config';
// This is a Node-run config file (not shipped plugin code), so the Node builtin
// is fine; eslint.config.mts scopes the mobile-safety rule to the plugin sources.
import { fileURLToPath } from 'node:url';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/tests/**/*.test.ts'],
		// Pinned rather than left to the default: vitest 4 defaulted this to false
		// and vitest 5 flipped it to true, so leaving it unset means a major can
		// change how spies behave between tests without anything here saying so.
		// true is the behaviour the suite wants anyway, since every assertion on a
		// spy should only see the calls its own test made.
		clearMocks: true,
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
