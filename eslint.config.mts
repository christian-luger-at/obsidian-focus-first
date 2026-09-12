import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';
import { fileURLToPath } from 'node:url';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'docs',
		'scripts',
		'releases',
		'.screenshot-vault',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json', 'vitest.config.ts'],
				},
				tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// Node-run tooling, never bundled into main.js. The mobile-safety rule exists
		// to keep Node builtins out of the plugin itself, so it does not apply here.
		files: ['eslint.config.mts', 'vitest.config.ts'],
		rules: {
			'obsidianmd/no-nodejs-modules': 'off',
		},
	},
	{
		files: ['src/tests/**/*.ts'],
		rules: {
			'import/no-extraneous-dependencies': 'off',
			// The Obsidian mock reimplements createEl() itself, and the tests assert on
			// exactly that call, so being told to use the createDiv()/createSpan()
			// shorthands the mock is in the middle of providing is circular here.
			'obsidianmd/prefer-create-el': 'off',
			// The settings tab keeps display() as the documented pre-1.13 fallback
			// (manifest minAppVersion is 1.12.0), so its tests call it on purpose.
			// Obsidian marks it deprecated in favour of getSettingDefinitions(),
			// which the same tab also implements and which has its own tests.
			'@typescript-eslint/no-deprecated': 'off',
		},
	},
);
