import { expect, test, type Page } from '@playwright/test';
import { addAccount, addAsset, registerAndOnboard } from './helpers';

/**
 * The Investments screen.
 *
 * Its dialogs carry state the server never sees until submission — the selected
 * currency decides which fields appear and what unit the amounts are in — so the
 * behaviour here cannot be checked by requesting the page and reading the HTML.
 * It needs a browser.
 *
 * One account for the whole file, built up in order, rather than one per test:
 * registration is rate limited to five an hour per address (RATE_LIMITS.register),
 * so a spec that registers per test spends the entire budget by itself.
 */

const HOLDING = 'World Equity ETF';

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
	page = await browser.newPage();
	await registerAndOnboard(page, 'investments');
});

test.afterAll(async () => {
	await page.close();
});

test.describe('investments', () => {
	test('an account with no holdings is told so, not shown empty figures', async () => {
		await page.goto('/investments');
		await expect(page.getByRole('heading', { name: 'No investment holdings' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Add a holding' })).toBeVisible();
	});

	test('an asset in a tradeable class becomes a holding', async () => {
		await addAccount(page, { name: 'Brokerage', type: 'brokerage' });
		await addAsset(page, { name: HOLDING, value: '50000', type: 'etf' });

		await page.goto('/investments');
		await expect(page.getByRole('cell', { name: HOLDING })).toBeVisible();
		// Sleeve is derived from the asset class, never entered by hand.
		await expect(page.getByRole('cell', { name: 'Equities' })).toBeVisible();
	});

	test('the chosen currency drives every money field in the dialog', async () => {
		await page.goto('/investments');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Record transaction' }).click();

		const dialog = page.getByRole('dialog');
		await dialog.waitFor({ state: 'visible' });

		// The unit shown beside each amount. Located by class because the element is
		// aria-hidden — it is decoration for sighted users, and the currency itself
		// is carried accessibly by the select.
		const units = dialog.locator('.code');
		const rateField = dialog.getByLabel(/Exchange rate/i);

		await expect(units.first()).toHaveText('THB');
		// Nothing to convert while the trade is in the base currency.
		await expect(rateField).toBeHidden();

		await dialog.getByLabel('Currency').selectOption('USD');
		for (const unit of await units.all()) await expect(unit).toHaveText('USD');
		await expect(rateField).toBeVisible();

		await dialog.getByLabel('Currency').selectOption('THB');
		for (const unit of await units.all()) await expect(unit).toHaveText('THB');
		await expect(rateField).toBeHidden();

		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await dialog.waitFor({ state: 'detached' });
	});

	test('a recorded buy appears in the table', async () => {
		await page.goto('/investments');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Record transaction' }).click();

		const dialog = page.getByRole('dialog');
		// A buy has to name the holding it applies to; the schema rejects it otherwise.
		await dialog.getByLabel('Holding').selectOption({ label: HOLDING });
		await dialog.getByLabel('Quantity').fill('10');
		await dialog.getByLabel('Unit price').fill('1000');
		await dialog.getByLabel('Amount').fill('10000');
		await dialog.getByRole('button', { name: 'Save transaction' }).click();
		await dialog.waitFor({ state: 'detached' });

		// Rendered through the money formatter, so grouped and carrying its unit.
		await expect(page.getByRole('cell', { name: /10,000/ }).first()).toBeVisible();
	});

	/**
	 * The dialog does not render every column it submits, and anything it leaves
	 * out is written as null — so a field that is merely not shown must still be
	 * carried through an edit.
	 */
	test('editing a trade keeps the exchange rate it was recorded with', async () => {
		await page.goto('/investments');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Record transaction' }).click();

		const dialog = page.getByRole('dialog');
		await dialog.getByLabel('Currency').selectOption('USD');
		await dialog.getByLabel('Holding').selectOption({ label: HOLDING });
		await dialog.getByLabel('Quantity').fill('5');
		await dialog.getByLabel('Unit price').fill('100');
		await dialog.getByLabel('Amount').fill('500');
		await dialog.getByLabel(/Exchange rate/i).fill('33');
		await dialog.getByRole('button', { name: 'Save transaction' }).click();
		await dialog.waitFor({ state: 'detached' });

		// The newest trade sorts first, so the first Edit button is the one just saved.
		await page.getByRole('button', { name: 'Edit' }).first().click();
		const edit = page.getByRole('dialog');
		await expect(edit.getByLabel(/Exchange rate/i)).toHaveValue('33.000000000000');

		await edit.getByLabel('Amount').fill('600');
		await edit.getByRole('button', { name: 'Save changes' }).click();
		await edit.waitFor({ state: 'detached' });

		await page.getByRole('button', { name: 'Edit' }).first().click();
		const again = page.getByRole('dialog');
		await expect(again.getByLabel('Amount')).toHaveValue('600.00000000');
		// The rate survived an edit that never mentioned it.
		await expect(again.getByLabel(/Exchange rate/i)).toHaveValue('33.000000000000');
	});
});
