import type { Page } from '@playwright/test';

/**
 * Shared e2e helpers.
 *
 * Every spec registers its own account, so runs never share state and a failed
 * run leaves nothing behind that breaks the next one.
 */

export function uniqueEmail(label: string): string {
	return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@wealthscope.test`;
}

export const PASSWORD = 'e2e-password-that-is-long';

export interface TestAccount {
	email: string;
	password: string;
	name: string;
}

/** Registers a new account and completes the first-run wizard. */
export async function registerAndOnboard(page: Page, label: string): Promise<TestAccount> {
	const account = { email: uniqueEmail(label), password: PASSWORD, name: `E2E ${label}` };

	await page.goto('/register');
	await page.getByLabel('Name').fill(account.name);
	await page.getByLabel('Email').fill(account.email);
	// Anchored rather than exact: FormField appends a visually-hidden "(required)"
	// to the label, so a required field's accessible name is never the bare label.
	// "Confirm password" does not start with "Password", so this stays unambiguous.
	await page.getByLabel(/^Password/).fill(account.password);
	await page.getByLabel('Confirm password').fill(account.password);
	await page.getByRole('button', { name: 'Create account' }).click();

	await page.waitForURL('**/welcome**');
	await page.getByRole('link', { name: 'Continue' }).click();
	await page.waitForURL('**/welcome?step=2');
	await page.getByRole('button', { name: 'Continue' }).click();
	await page.waitForURL('**/welcome?step=3');
	await page.getByRole('button', { name: 'Skip for now' }).click();
	await page.waitForURL('**/dashboard');

	return account;
}

export async function signIn(page: Page, account: TestAccount): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Email').fill(account.email);
	await page.getByLabel('Password').fill(account.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/dashboard');
}

export async function signOut(page: Page): Promise<void> {
	await page.goto('/settings');
	await page.getByRole('button', { name: 'Sign out of this browser' }).click();
	await page.waitForURL('**/login**');
}

/**
 * Adds one account through the dialog on /accounts.
 *
 * A transaction needs one: the Account field is required, and a freshly
 * onboarded user has none.
 */
export async function addAccount(
	page: Page,
	options: { name: string; type?: string; currency?: string }
): Promise<void> {
	await page.goto('/accounts');
	await page.getByRole('button', { name: 'Add account' }).first().click();

	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Name').fill(options.name);
	if (options.type) await dialog.getByLabel('Type').selectOption(options.type);
	if (options.currency) await dialog.getByLabel('Currency').selectOption(options.currency);
	await dialog.getByRole('button', { name: 'Save account' }).click();
	await dialog.waitFor({ state: 'detached' });
}

/** Adds one asset through the dialog on /assets. */
export async function addAsset(
	page: Page,
	options: { name: string; value: string; type?: string }
): Promise<void> {
	await page.goto('/assets');
	await page.getByRole('button', { name: 'Add asset' }).first().click();

	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Name').fill(options.name);
	if (options.type) await dialog.getByLabel('Class').selectOption(options.type);
	await dialog.getByLabel('Quantity').fill('1');
	await dialog.getByLabel('Unit price').fill(options.value);
	await dialog.getByRole('button', { name: 'Save asset' }).click();
	await dialog.waitFor({ state: 'detached' });
}
