<script lang="ts">
	/**
	 * Landing page. Uses the design's onboarding step-one composition: a display
	 * headline, three rule-topped columns, and the primary action.
	 */
	const pillars = [
		{
			title: 'Every record, one balance sheet',
			body: 'Property, cash, deposits, retirement savings, holdings, loans, income and expenses — recorded once and analysed together.'
		},
		{
			title: 'Exact arithmetic',
			body: 'Money is stored as exact decimals and computed with Decimal.js. No floating-point drift between what you entered and what you are shown.'
		},
		{
			title: 'Yours to take with you',
			body: 'Full CSV export at any time, plus PDF statements generated on demand. Nothing is locked in.'
		}
	];

	const capabilities = [
		['Net worth', 'Assets less liabilities, converted into one base currency.'],
		['Allocation', 'By class, account, currency and instrument, with concentration measures.'],
		['Liquidity', 'A three-band ladder and months of emergency cover.'],
		['Debt', 'Weighted rates, debt service, payoff order and amortisation.'],
		['Risk', 'Volatility, drawdown, correlation and stress scenarios.'],
		['Projection', 'Deterministic compounding under assumptions you set.']
	];
</script>

<svelte:head>
	<title>WealthScope · Personal wealth analysis</title>
	<meta
		name="description"
		content="Record your assets, investments, liabilities, income and expenses, then analyse net worth, allocation, liquidity, risk and projected wealth."
	/>
</svelte:head>

<div class="page">
	<header class="topbar">
		<span class="brand">WealthScope</span>
		<nav aria-label="Account">
			<a class="btn btn-secondary" href="/login">Sign in</a>
			<a class="btn btn-primary" href="/register">Create an account</a>
		</nav>
	</header>

	<main>
		<section class="hero">
			<h1>Your whole balance sheet, computed exactly.</h1>
			<p class="lede">
				WealthScope records assets, investments, deposits, liabilities, income, expenses, interest,
				fees and taxes, then analyses net worth, allocation, liquidity, financial health, portfolio
				risk, concentration and future wealth.
			</p>
			<div class="ws-row hero-actions">
				<a class="btn btn-primary" href="/register">Create an account</a>
				<a class="btn btn-secondary" href="/login">Sign in</a>
			</div>
		</section>

		<section class="pillars" aria-label="Why WealthScope">
			{#each pillars as pillar (pillar.title)}
				<div class="pillar">
					<h2>{pillar.title}</h2>
					<p class="text-muted">{pillar.body}</p>
				</div>
			{/each}
		</section>

		<section class="capabilities">
			<h2 class="section-title">What it computes</h2>
			<dl>
				{#each capabilities as [term, description] (term)}
					<div class="row">
						<dt>{term}</dt>
						<dd class="text-muted">{description}</dd>
					</div>
				{/each}
			</dl>
		</section>

		<section class="banner">
			<h2>Start with three records or three thousand.</h2>
			<p>
				Import a CSV from your bank or broker, or enter records by hand. Every screen fills in as
				you go.
			</p>
			<a class="btn btn-secondary" href="/register">Create an account</a>
		</section>
	</main>

	<footer>
		<span class="text-muted">WealthScope</span>
		<nav aria-label="Legal">
			<a href="/privacy">Privacy</a>
			<a href="/terms">Terms</a>
		</nav>
	</footer>
</div>

<style>
	.page {
		max-width: 1160px;
		margin: 0 auto;
		padding: 0 var(--space-6);
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-4) 0;
		border-bottom: 2px solid var(--color-divider);
	}
	.brand {
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: 19px;
		letter-spacing: -0.02em;
		margin-right: auto;
	}
	.topbar nav {
		display: flex;
		gap: var(--space-2);
	}

	.hero {
		padding: var(--space-8) 0;
	}
	h1 {
		font-size: var(--ws-display);
		max-width: 18ch;
		margin-bottom: var(--space-4);
	}
	.lede {
		font-size: 16px;
		max-width: 62ch;
	}
	.hero-actions {
		margin-top: var(--space-6);
	}

	.pillars {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-6);
		padding-bottom: var(--space-8);
	}
	.pillar {
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-3);
	}
	.pillar h2 {
		font-size: 15px;
		margin-bottom: 4px;
	}
	.pillar p {
		font-size: 12.5px;
		margin: 0;
	}

	.capabilities {
		border-top: 2px solid var(--color-divider);
		padding: var(--space-6) 0 var(--space-8);
	}
	.section-title {
		font-size: 20px;
		margin-bottom: var(--space-4);
	}
	dl {
		margin: 0;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 200px) minmax(0, 1fr);
		gap: var(--space-4);
		border-top: 1px solid var(--color-divider);
		padding: var(--space-3) 0;
	}
	dt {
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: 14px;
	}
	dd {
		margin: 0;
		font-size: 13px;
	}

	.banner {
		background: var(--color-accent);
		color: var(--color-bg);
		padding: var(--space-8) var(--space-6);
		margin-bottom: var(--space-8);
	}
	.banner h2 {
		font-size: calc(var(--ws-display) * 0.7);
		max-width: 20ch;
		margin-bottom: var(--space-3);
	}
	.banner p {
		max-width: 55ch;
		font-size: 14px;
	}
	.banner .btn {
		background: var(--color-bg);
		border-color: var(--color-bg);
		margin-top: var(--space-3);
	}

	footer {
		margin-top: auto;
		border-top: 2px solid var(--color-divider);
		padding: var(--space-4) 0;
		display: flex;
		gap: var(--space-4);
		font-size: 12px;
	}
	footer nav {
		margin-left: auto;
		display: flex;
		gap: var(--space-4);
	}

	@media (max-width: 900px) {
		.pillars {
			grid-template-columns: 1fr;
			gap: var(--space-4);
		}
		.row {
			grid-template-columns: 1fr;
			gap: 2px;
		}
		.topbar {
			flex-wrap: wrap;
		}
	}
</style>
