import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores } from 'eslint/config';
import { fileURLToPath } from 'node:url';

export default tseslint.config(
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
		files: ['src/tests/**/*.ts'],
		rules: {
			'import/no-extraneous-dependencies': 'off',
			// The settings tab keeps display() as the documented pre-1.13 fallback
			// (manifest minAppVersion is 1.12.0), so its tests call it on purpose.
			// Obsidian marks it deprecated in favour of getSettingDefinitions(),
			// which the same tab also implements and which has its own tests.
			'@typescript-eslint/no-deprecated': 'off',
		},
	},
);
