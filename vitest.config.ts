import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/tests/**/*.test.ts'],
		alias: {
			obsidian: '/Users/christian/dev/obsidian-focus-first/src/tests/__mocks__/obsidian.ts',
		},
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/tests/**'],
			all: true,
		},
	},
});
