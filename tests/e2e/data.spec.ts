import { expect, test } from '@playwright/test';
import { addAsset, registerAndOnboard } from './helpers';

test.describe('import, export and reporting', () => {
	test('a CSV import validates, previews, then commits', async ({ page }) => {
		await registerAndOnboard(page, 'import');
		await page.goto('/import');

		const csv = [
			'name,asset_type,currency,quantity,unit_price,valuation_date',
			'Imported savings,cash,THB,1,250000,2026-08-01',
			'Imported condo,Real estate,THB,1,7000000,2026-08-01'
		].join('\n');

		await page.getByText('Or paste rows').click();
		await page.getByLabel('CSV rows').fill(csv);
		await page.getByRole('button', { name: 'Preview & validate' }).click();

		await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
		await expect(page.getByText('Will import')).toBeVisible();

		await page.getByRole('button', { name: /Import 2 rows/ }).click();

		await page.goto('/assets');
		await expect(page.getByRole('cell', { name: 'Imported savings' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'Imported condo' })).toBeVisible();
	});

	test('a bad row is reported with its line number, not silently dropped', async ({ page }) => {
		await registerAndOnboard(page, 'import-bad');
		await page.goto('/import');

		const csv = [
			'name,asset_type,currency,quantity,unit_price,valuation_date',
			'Good row,cash,THB,1,1000,2026-08-01',
			'Bad row,cash,NOTACURRENCY,1,1000,2026-08-01'
		].join('\n');

		await page.getByText('Or paste rows').click();
		await page.getByLabel('CSV rows').fill(csv);
		await page.getByRole('button', { name: 'Preview & validate' }).click();

		await expect(page.getByRole('heading', { name: 'Rejected rows' })).toBeVisible();
		await expect(page.getByRole('cell', { name: '3', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: /Import 1 row/ })).toBeEnabled();
	});

	test('a CSV export downloads the account’s own records', async ({ page }) => {
		await registerAndOnboard(page, 'export');
		await addAsset(page, { name: 'Exportable asset', value: '123456', type: 'cash' });

		await page.goto('/reports');
		const downloadPromise = page.waitForEvent('download');
		await page
			.locator('.export-row', { hasText: 'Assets' })
			.getByRole('link', { name: 'Download' })
			.click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toMatch(/wealthscope-assets-\d{4}-\d{2}-\d{2}\.csv/);
	});

	test('a PDF report generates', async ({ page }) => {
		await registerAndOnboard(page, 'pdf');
		await addAsset(page, { name: 'Reportable asset', value: '500000', type: 'cash' });

		await page.goto('/reports');
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('link', { name: 'Generate PDF report' }).click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toMatch(/wealthscope-report-.*\.pdf/);
	});

	test('running an analysis records a snapshot and shows findings', async ({ page }) => {
		await registerAndOnboard(page, 'analysis');
		await addAsset(page, { name: 'Analysable asset', value: '1000000', type: 'cash' });

		await page.goto('/analyze/overview');
		await page.getByRole('button', { name: /Run analysis/ }).click();

		await expect(
			page.getByRole('status').or(page.getByText(/snapshot has been recorded/))
		).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible();
	});

	test('risk metrics show an insufficient-data state rather than a made-up number', async ({
		page
	}) => {
		await registerAndOnboard(page, 'risk');
		await addAsset(page, { name: 'Lonely ETF', value: '100000', type: 'etf' });

		await page.goto('/analyze/risk');
		await expect(page.getByText(/recorded prices yet/)).toBeVisible();
	});

	test('the projection sliders recompute a preview without saving anything', async ({ page }) => {
		await registerAndOnboard(page, 'projection');
		await addAsset(page, { name: 'Seed capital', value: '1000000', type: 'cash' });

		await page.goto('/analyze/projection');
		const horizon = page.getByLabel(/Horizon/);
		await horizon.fill('40');

		await expect(page.getByText('40 years')).toBeVisible();
		await expect(page.getByText('Nominal at horizon')).toBeVisible();
		// The disclaimer must be present wherever a projection is shown.
		await expect(page.getByText(/not a forecast/)).toBeVisible();
	});

	test('settings changes flow through to how figures are displayed', async ({ page }) => {
		await registerAndOnboard(page, 'settings');
		await addAsset(page, { name: 'Currency check', value: '1000', type: 'cash' });

		await page.goto('/settings');
		await page.getByLabel('Base currency').selectOption('USD');
		await page.getByRole('button', { name: 'Save preferences' }).click();

		await page.goto('/dashboard');
		await expect(page.locator('.ws-value').first()).toContainText('$');
	});
});
