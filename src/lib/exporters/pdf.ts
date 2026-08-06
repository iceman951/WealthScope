import type { AnalysisMetrics } from '$engine/analysis';
import { formatMoney, formatOptionalPercent, formatPercent, NO_DATA } from '$engine/money';

/**
 * PDF report generation with pdf-lib.
 *
 * pdf-lib is imported dynamically so it never lands in the initial bundle — it is
 * pulled in only when a report is actually requested.
 *
 * Limitation: the standard PDF fonts are Latin-1 only. Report text is therefore
 * transliterated where necessary; see README "Known limitations".
 */

export interface ReportSections {
	netWorth: boolean;
	allocation: boolean;
	risk: boolean;
	records: boolean;
}

export interface ReportOptions {
	title: string;
	userName: string;
	baseCurrency: string;
	locale: string;
	displayDecimals: number;
	from: string;
	to: string;
	generatedAt: string;
	sections: ReportSections;
	/** True when the report includes projected figures. */
	includesProjections: boolean;
}

const PAGE_WIDTH = 595.28; // A4 portrait
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const LINE = 14;

/** Standard PDF fonts cannot encode Thai; drop to a code the font can draw. */
function latin1(text: string): string {
	return text
		.replace(/[−]/g, '-')
		.replace(/[–—]/g, '-')
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/·/g, '.')
		.replace(/[^\x20-\xFF]/g, '?');
}

export async function buildPortfolioReport(
	metrics: AnalysisMetrics,
	options: ReportOptions
): Promise<Uint8Array> {
	const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

	const pdf = await PDFDocument.create();
	pdf.setTitle(options.title);
	pdf.setCreator('WealthScope');
	pdf.setProducer('WealthScope');

	const body = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const ink = rgb(0.125, 0.118, 0.114); // --color-text
	const accent = rgb(0.925, 0.188, 0.075); // --color-accent
	const muted = rgb(0.45, 0.44, 0.43);

	let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
	let y = PAGE_HEIGHT - MARGIN;

	const money = (value: Parameters<typeof formatMoney>[0]) =>
		formatMoney(value, options.baseCurrency, {
			locale: options.locale,
			decimals: options.displayDecimals
		});

	const newPageIfNeeded = (needed: number) => {
		if (y - needed > MARGIN) return;
		page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
		y = PAGE_HEIGHT - MARGIN;
	};

	const text = (
		value: string,
		options2: { size?: number; font?: typeof body; color?: typeof ink; x?: number } = {}
	) => {
		const size = options2.size ?? 10;
		page.drawText(latin1(value), {
			x: options2.x ?? MARGIN,
			y,
			size,
			font: options2.font ?? body,
			color: options2.color ?? ink
		});
	};

	const rule = (thickness = 2) => {
		page.drawRectangle({
			x: MARGIN,
			y,
			width: PAGE_WIDTH - MARGIN * 2,
			height: thickness,
			color: ink
		});
		y -= LINE;
	};

	const heading = (label: string) => {
		newPageIfNeeded(60);
		y -= LINE;
		text(label, { size: 15, font: bold });
		y -= 8;
		rule(2);
	};

	const row = (label: string, value: string, emphasis = false) => {
		newPageIfNeeded(LINE * 2);
		text(label, { size: 10, color: emphasis ? ink : muted, font: emphasis ? bold : body });
		const font = emphasis ? bold : body;
		const width = font.widthOfTextAtSize(latin1(value), 10);
		page.drawText(latin1(value), {
			x: PAGE_WIDTH - MARGIN - width,
			y,
			size: 10,
			font,
			color: ink
		});
		y -= LINE;
	};

	/* ── cover ───────────────────────────────────────────────────────────── */
	text('WEALTHSCOPE', { size: 9, color: accent, font: bold });
	y -= 22;
	text(options.title, { size: 26, font: bold });
	y -= 22;
	text(`Prepared for ${options.userName}`, { size: 11, color: muted });
	y -= LINE;
	text(`Period ${options.from} to ${options.to}  |  Base currency ${options.baseCurrency}`, {
		size: 10,
		color: muted
	});
	y -= LINE;
	text(`Generated ${options.generatedAt}`, { size: 10, color: muted });
	y -= 10;
	rule(2);

	if (metrics.missingRates.length > 0) {
		text(
			`Incomplete: no exchange rate for ${metrics.missingRates.join(', ')}. Those holdings are excluded from every total below.`,
			{ size: 9, color: accent }
		);
		y -= LINE * 1.5;
	}

	/* ── net worth ───────────────────────────────────────────────────────── */
	if (options.sections.netWorth) {
		heading('Net worth statement');
		row('Total assets', money(metrics.netWorth.totalAssets));
		row('Total liabilities', money(metrics.netWorth.totalLiabilities));
		row('Net worth', money(metrics.netWorth.netWorth), true);
		y -= 6;
		row('Liquid assets', money(metrics.netWorth.liquidAssets));
		row('Investment assets', money(metrics.netWorth.investmentAssets));
		y -= 6;
		row('Monthly income', money(metrics.cashflow.monthlyIncome));
		row('Monthly expenses', money(metrics.cashflow.monthlyExpenses));
		row('Net monthly flow', money(metrics.cashflow.netCashflow), true);
		row(
			'Savings rate',
			metrics.cashflow.savingsRate === null ? NO_DATA : formatPercent(metrics.cashflow.savingsRate)
		);
		y -= 6;
		row('Debt-to-assets', formatOptionalPercent(metrics.debt.debtToAssets));
		row('Debt service ratio', formatOptionalPercent(metrics.debt.debtServiceRatio));
		row(
			'Financial health score',
			metrics.health.composite === null
				? NO_DATA
				: `${metrics.health.composite} / 100 - ${metrics.health.band}`
		);
	}

	/* ── allocation ──────────────────────────────────────────────────────── */
	if (options.sections.allocation) {
		heading('Allocation and liquidity');
		for (const slice of metrics.allocationByClass) {
			row(slice.label, `${money(slice.value)}  ${formatOptionalPercent(slice.share)}`);
		}
		y -= 8;
		text('Liquidity ladder', { size: 11, font: bold });
		y -= LINE;
		for (const band of metrics.liquidity) {
			row(band.label, `${money(band.value)}  ${formatOptionalPercent(band.share)}`);
		}
		row(
			'Emergency cover',
			metrics.liquidityCover === null
				? NO_DATA
				: `${metrics.liquidityCover.toFixed(1)} months of expenses`,
			true
		);
	}

	/* ── risk ────────────────────────────────────────────────────────────── */
	if (options.sections.risk) {
		heading('Risk and concentration');
		row(
			'Concentration (HHI)',
			metrics.portfolioConcentration.hhi === null
				? NO_DATA
				: metrics.portfolioConcentration.hhi.toFixed(2)
		);
		row('Largest holding', formatOptionalPercent(metrics.portfolioConcentration.top1Share));
		row('Top three holdings', formatOptionalPercent(metrics.portfolioConcentration.top3Share));
		row(
			'Effective holdings',
			metrics.portfolioConcentration.effectiveHoldings === null
				? NO_DATA
				: metrics.portfolioConcentration.effectiveHoldings.toFixed(1)
		);
		y -= 8;
		text('Stress tests', { size: 11, font: bold });
		y -= LINE;
		for (const result of metrics.stress) {
			row(result.scenario.label, money(result.impact));
		}
		y -= 8;
		text('Currency exposure', { size: 11, font: bold });
		y -= LINE;
		for (const exposure of metrics.currencyExposure) {
			row(exposure.currency, `${money(exposure.value)}  ${formatOptionalPercent(exposure.share)}`);
		}
	}

	/* ── records ─────────────────────────────────────────────────────────── */
	if (options.sections.records) {
		heading('Record listing');
		text('Assets', { size: 11, font: bold });
		y -= LINE;
		for (const asset of metrics.netWorth.assets) {
			row(
				`${asset.asset.name}${asset.asset.symbol ? ` (${asset.asset.symbol})` : ''}`,
				`${money(asset.baseValue)}  ${asset.liquidity}`
			);
		}
		y -= 8;
		newPageIfNeeded(LINE * 4);
		text('Liabilities', { size: 11, font: bold });
		y -= LINE;
		for (const position of metrics.debt.positions) {
			row(position.name, `${money(position.balance)}  ${formatPercent(position.annualRate)} p.a.`);
		}
	}

	/* ── disclaimer ──────────────────────────────────────────────────────── */
	newPageIfNeeded(LINE * 6);
	y -= LINE;
	rule(2);
	text('Basis of preparation', { size: 10, font: bold });
	y -= LINE;
	const disclaimer = options.includesProjections
		? 'Figures are computed from the records held in this account on the generation date. Projected figures are arithmetic on the assumptions stated above: they are not forecasts, not advice, and not a guarantee of any outcome. Actual returns will differ.'
		: 'Figures are computed from the records held in this account on the generation date. This report is a statement of those records, not investment advice.';

	for (const line of wrap(disclaimer, 95)) {
		newPageIfNeeded(LINE);
		text(line, { size: 8.5, color: muted });
		y -= 11;
	}

	return pdf.save();
}

function wrap(input: string, width: number): string[] {
	const words = input.split(' ');
	const lines: string[] = [];
	let current = '';
	for (const word of words) {
		if ((current + word).length > width) {
			lines.push(current.trim());
			current = '';
		}
		current += `${word} `;
	}
	if (current.trim()) lines.push(current.trim());
	return lines;
}

export function pdfResponse(filename: string, bytes: Uint8Array): Response {
	// Copy into a fresh ArrayBuffer so the Response body has a plain, detachable buffer.
	const buffer = new Uint8Array(bytes).buffer;
	return new Response(buffer, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
			'cache-control': 'private, no-store'
		}
	});
}
