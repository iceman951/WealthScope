import { expect, test } from '@playwright/test';
import { addAsset, registerAndOnboard } from './helpers';

test.describe('records', () => {
	test('an empty account shows the zero-data state, not fabricated figures', async ({ page }) => {
		await registerAndOnboard(page, 'empty');
		await expect(page.getByRole('heading', { name: 'No records yet' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Add an asset' })).toBeVisible();
	});

	test('creating an asset updates the dashboard totals', async ({ page }) => {
		await registerAndOnboard(page, 'create-asset');
		await addAsset(page, { name: 'Emergency savings', value: '640000', type: 'cash' });

		await expect(page.getByRole('cell', { name: 'Emergency savings' })).toBeVisible();

		await page.goto('/dashboard');
		await expect(page.getByText('Net worth')).toBeVisible();
		// The figure comes from the database, not from a hardcoded prototype value.
		await expect(page.locator('.ws-value').first()).toContainText('640,000');
	});

	test('an asset can be edited and the total follows', async ({ page }) => {
		await registerAndOnboard(page, 'edit-asset');
		await addAsset(page, { name: 'Savings', value: '100000', type: 'cash' });

		await page.getByRole('button', { name: 'Edit' }).first().click();
		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Unit price').fill('250000');
		await dialog.getByRole('button', { name: 'Save changes' }).click();
		await dialog.waitFor({ state: 'detached' });

		await page.goto('/dashboard');
		await expect(page.locator('.ws-value').first()).toContainText('250,000');
	});

	test('deleting an asset asks for confirmation first', async ({ page }) => {
		await registerAndOnboard(page, 'delete-asset');
		await addAsset(page, { name: 'Disposable', value: '5000', type: 'cash' });

		await page.getByRole('button', { name: 'Remove' }).first().click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('deleted permanently');

		await dialog.getByRole('button', { name: 'Remove asset' }).click();
		await dialog.waitFor({ state: 'detached' });

		await expect(page.getByRole('cell', { name: 'Disposable' })).toHaveCount(0);
	});

	test('a liability can be created and appears in the debt metrics', async ({ page }) => {
		await registerAndOnboard(page, 'liability');
		await page.goto('/liabilities');
		await page.getByRole('button', { name: 'Add liability' }).first().click();

		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Name').fill('Car loan');
		await dialog.getByLabel('Type').selectOption('auto_loan');
		await dialog.getByLabel('Original principal').fill('620000');
		await dialog.getByLabel('Outstanding balance').fill('186000');
		await dialog.getByLabel('Interest rate').fill('6.9');
		await dialog.getByLabel('Monthly payment').fill('11400');
		await dialog.getByRole('button', { name: 'Save liability' }).click();
		await dialog.waitFor({ state: 'detached' });

		await expect(page.getByRole('cell', { name: 'Car loan' })).toBeVisible();
		await expect(page.getByText('Payoff order')).toBeVisible();
	});

	test('a cash-flow entry drives the savings rate', async ({ page }) => {
		await registerAndOnboard(page, 'cashflow');
		await page.goto('/cashflow');

		await page.getByRole('button', { name: 'Add income' }).first().click();
		let dialog = page.getByRole('dialog');
		await dialog.getByLabel('Name').fill('Salary');
		await dialog.getByLabel('Amount').fill('150000');
		await dialog.getByRole('button', { name: 'Save entry' }).click();
		await dialog.waitFor({ state: 'detached' });

		await page.getByRole('button', { name: 'Add expense' }).first().click();
		dialog = page.getByRole('dialog');
		await dialog.getByLabel('Direction').selectOption('expense');
		await dialog.getByLabel('Name').fill('Living');
		await dialog.getByLabel('Amount').fill('90000');
		await dialog.getByRole('button', { name: 'Save entry' }).click();
		await dialog.waitFor({ state: 'detached' });

		// (150000 − 90000) / 150000 = 40%
		await expect(page.getByText('40.0%')).toBeVisible();
	});

	test('a validation failure keeps the dialog open with the message attached', async ({ page }) => {
		await registerAndOnboard(page, 'validation');
		await page.goto('/assets');
		await page.getByRole('button', { name: 'Add asset' }).first().click();

		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Name').fill('No value');
		await dialog.getByLabel('Quantity').fill('0');
		await dialog.getByLabel('Unit price').fill('0');
		await dialog.getByRole('button', { name: 'Save asset' }).click();

		await expect(dialog).toBeVisible();
		await expect(dialog.getByText('Enter a value, or a quantity and a unit price')).toBeVisible();
	});

	test('a dialog closes on Escape and returns focus', async ({ page }) => {
		await registerAndOnboard(page, 'escape');
		await page.goto('/assets');
		const trigger = page.getByRole('button', { name: 'Add asset' }).first();
		await trigger.click();

		await expect(page.getByRole('dialog')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(trigger).toBeFocused();
	});
});
