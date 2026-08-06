import { expect, test } from '@playwright/test';
import { PASSWORD, registerAndOnboard, signIn, signOut, uniqueEmail } from './helpers';

test.describe('authentication', () => {
	test('a visitor can register, is onboarded, and lands on the dashboard', async ({ page }) => {
		await registerAndOnboard(page, 'register');
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
	});

	test('a registered user can sign out and back in', async ({ page }) => {
		const account = await registerAndOnboard(page, 'roundtrip');
		await signOut(page);
		await expect(page).toHaveURL(/\/login/);

		await signIn(page, account);
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test('a protected route redirects to sign-in and returns afterwards', async ({ page }) => {
		const account = await registerAndOnboard(page, 'redirect');
		await signOut(page);

		await page.goto('/assets');
		await expect(page).toHaveURL(/\/login\?redirectTo=%2Fassets/);

		await page.getByLabel('Email').fill(account.email);
		await page.getByLabel('Password').fill(account.password);
		await page.getByRole('button', { name: 'Sign in' }).click();

		await expect(page).toHaveURL(/\/assets/);
	});

	test('wrong credentials give one generic message, not an account oracle', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill(uniqueEmail('nobody'));
		await page.getByLabel('Password').fill('some-wrong-password');
		await page.getByRole('button', { name: 'Sign in' }).click();

		const error = page.getByRole('alert');
		await expect(error).toBeVisible();
		await expect(error).toContainText('do not match an account');
		// It must not distinguish "no such account" from "wrong password".
		await expect(error).not.toContainText('not registered');
	});

	test('registration rejects a short password and a mismatched confirmation', async ({ page }) => {
		await page.goto('/register');
		await page.getByLabel('Name').fill('Short Password');
		await page.getByLabel('Email').fill(uniqueEmail('short'));
		await page.getByLabel('Password', { exact: true }).fill('tooshort');
		await page.getByLabel('Confirm password').fill('different');
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect(page.getByText('Use at least 12 characters')).toBeVisible();
		await expect(page.getByText('The two passwords do not match')).toBeVisible();
		await expect(page).toHaveURL(/\/register/);
	});

	test('a form submits from the keyboard alone', async ({ page }) => {
		const account = await registerAndOnboard(page, 'keyboard');
		await signOut(page);

		await page.goto('/login');
		await page.getByLabel('Email').fill(account.email);
		await page.getByLabel('Password').fill(PASSWORD);
		await page.getByLabel('Password').press('Enter');

		await expect(page).toHaveURL(/\/dashboard/);
	});

	test('a signed-in user is bounced away from the sign-in page', async ({ page }) => {
		await registerAndOnboard(page, 'guestonly');
		await page.goto('/login');
		await expect(page).toHaveURL(/\/dashboard/);
	});
});
