<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Two-column credential frame: the form on the left, the poster on the right. */
	let { children }: { children: Snippet } = $props();
</script>

<div class="auth">
	<div class="panel">
		<a class="brand" href="/">
			<span class="brand-name">WealthScope</span>
			<span class="brand-sub">Personal wealth analysis</span>
		</a>
		<div class="form-wrap">
			{@render children()}
		</div>
		<footer>
			<a href="/privacy">Privacy</a>
			<a href="/terms">Terms</a>
		</footer>
	</div>

	<aside class="poster" aria-hidden="true">
		<p class="statement">Your whole balance sheet, computed exactly.</p>
		<dl>
			<div>
				<dt>Net worth</dt>
				<dd>Assets less liabilities, one base currency</dd>
			</div>
			<div>
				<dt>Allocation</dt>
				<dd>Class, account, currency, instrument</dd>
			</div>
			<div>
				<dt>Risk</dt>
				<dd>Volatility, drawdown, concentration</dd>
			</div>
			<div>
				<dt>Projection</dt>
				<dd>Compounding under your assumptions</dd>
			</div>
		</dl>
	</aside>
</div>

<style>
	.auth {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		min-height: 100dvh;
	}
	.panel {
		display: flex;
		flex-direction: column;
		padding: var(--space-6);
		border-right: 2px solid var(--color-divider);
	}
	.brand {
		text-decoration: none;
		color: inherit;
	}
	.brand-name {
		display: block;
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: 19px;
		letter-spacing: -0.02em;
	}
	.brand-sub {
		display: block;
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-text) 50%, transparent);
		margin-top: 2px;
	}
	.form-wrap {
		flex: 1;
		display: flex;
		align-items: center;
		padding: var(--space-8) 0;
	}
	.form-wrap :global(> *) {
		width: 100%;
		max-width: 420px;
	}
	footer {
		display: flex;
		gap: var(--space-4);
		font-size: 12px;
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-3);
	}

	.poster {
		background: var(--color-accent);
		color: var(--color-bg);
		padding: var(--space-8) var(--space-6);
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.statement {
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: calc(var(--ws-display) * 0.86);
		line-height: 1.08;
		letter-spacing: -0.03em;
		max-width: 14ch;
		margin-bottom: var(--space-8);
	}
	dl {
		margin: 0;
	}
	dl div {
		border-top: 2px solid color-mix(in srgb, var(--color-bg) 45%, transparent);
		padding: var(--space-3) 0;
	}
	dt {
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: 14px;
	}
	dd {
		margin: 0;
		font-size: 12.5px;
		opacity: 0.85;
	}

	@media (max-width: 900px) {
		.auth {
			grid-template-columns: 1fr;
		}
		.panel {
			border-right: 0;
		}
		.poster {
			display: none;
		}
	}
</style>
