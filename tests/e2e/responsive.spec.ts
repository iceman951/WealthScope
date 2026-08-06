import { expect, test } from '@playwright/test';
import { registerAndOnboard } from './helpers';

test.describe('responsive and accessible behaviour', () => {
	test('mobile navigation opens from the menu and closes on navigation', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 780 });
		await registerAndOnboard(page, 'mobile-nav');

		const menu = page.getByRole('button', { name: 'Menu' });
		await expect(menu).toBeVisible();
		await expect(menu).toHaveAttribute('aria-expanded', 'false');

		await menu.click();
		await expect(menu).toHaveAttribute('aria-expanded', 'true');

		await page.getByRole('link', { name: 'Assets', exact: true }).click();
		await expect(page).toHaveURL(/\/assets/);
		await expect(menu).toHaveAttribute('aria-expanded', 'false');
	});

	test('no page scrolls horizontally at 360px', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 780 });
		await registerAndOnboard(page, 'mobile-overflow');

		for (const path of ['/dashboard', '/assets', '/liabilities', '/cashflow', '/settings']) {
			await page.goto(path);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
		}
	});

	test('the desktop rail is visible and the menu button is not', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await registerAndOnboard(page, 'desktop-nav');

		await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
	});

	test('the skip link is the first focus stop and reaches the content', async ({ page }) => {
		await registerAndOnboard(page, 'skip-link');
		await page.goto('/dashboard');

		await page.keyboard.press('Tab');
		const skip = page.getByRole('link', { name: 'Skip to content' });
		await expect(skip).toBeFocused();

		await skip.press('Enter');
		await expect(page.locator('#main-content')).toBeFocused();
	});

	test('every screen has exactly one level-one heading', async ({ page }) => {
		await registerAndOnboard(page, 'headings');

		for (const path of ['/dashboard', '/assets', '/liabilities', '/cashflow', '/reports']) {
			await page.goto(path);
			await expect(page.getByRole('heading', { level: 1 }), `${path}`).toHaveCount(1);
		}
	});

	test('a chart offers its data as a table', async ({ page }) => {
		await registerAndOnboard(page, 'chart-table');
		await page.goto('/cashflow');

		await page.goto('/assets');
		await page.getByRole('button', { name: 'Add asset' }).first().click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Name').fill('Chartable');
		await dialog.getByLabel('Quantity').fill('1');
		await dialog.getByLabel('Unit price').fill('100000');
		await dialog.getByRole('button', { name: 'Save asset' }).click();
		await dialog.waitFor({ state: 'detached' });

		await page.goto('/dashboard');
		const toggle = page.getByRole('button', { name: 'Show as table' }).first();
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	});

	test('the landing page is reachable without a session', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Create an account' }).first()).toBeVisible();

		await page.goto('/privacy');
		await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
	});
});
