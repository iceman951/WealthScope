<script lang="ts">
	/**
	 * A form-level or page-level failure. Always announced, always carries a word —
	 * never colour alone.
	 */
	interface Props {
		message: string;
		/** Correlation id from the server log, when there is one. */
		code?: string;
		tone?: 'error' | 'warning';
	}

	let { message, code, tone = 'error' }: Props = $props();
</script>

<div class="message" class:warning={tone === 'warning'} role="alert">
	<span class="label">{tone === 'warning' ? 'Warning' : 'Error'}</span>
	<span class="body">
		{message}
		{#if code}<span class="code">Reference {code}</span>{/if}
	</span>
</div>

<style>
	.message {
		display: flex;
		gap: var(--space-3);
		align-items: baseline;
		border-left: 3px solid var(--color-accent);
		background: var(--color-accent-100);
		color: var(--color-accent-800);
		padding: var(--space-3);
		font-size: 13px;
	}
	.warning {
		border-left-color: var(--color-neutral-600);
		background: var(--color-neutral-100);
		color: var(--color-neutral-800);
	}
	.label {
		font: 800 10px var(--font-heading);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		flex: none;
	}
	.body {
		min-width: 0;
	}
	.code {
		display: block;
		font-size: 11px;
		opacity: 0.75;
		margin-top: 2px;
	}
</style>
