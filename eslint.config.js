import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import svelteConfig from './svelte.config.js';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// `any` erases the type safety the financial layers depend on.
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			],
			// Server logging goes through $lib/server/security/logging, which redacts.
			'no-console': ['warn', { allow: ['warn', 'error'] }]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				// The Svelte parser needs the TS parser to read `<script lang="ts">`.
				parser: ts.parser,
				extraFileExtensions: ['.svelte'],
				svelteConfig
			}
		},
		rules: {
			// The app is served from the origin root with no configured base path,
			// so plain hrefs are correct here and resolve() would add noise.
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		files: ['scripts/**/*.ts', 'tests/**/*.ts'],
		rules: { 'no-console': 'off' }
	},
	{
		ignores: [
			'.svelte-kit/',
			'.wrangler/',
			'build/',
			'dist/',
			'drizzle/',
			'node_modules/',
			'playwright-report/',
			'test-results/'
		]
	}
);
