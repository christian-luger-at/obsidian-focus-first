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
		},
	},
);
