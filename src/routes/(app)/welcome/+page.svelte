<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$components/base/Button.svelte';
	import ErrorMessage from '$components/feedback/ErrorMessage.svelte';
	import FormField from '$components/forms/FormField.svelte';
	import NumberInput from '$components/forms/NumberInput.svelte';
	import SegmentedControl from '$components/forms/SegmentedControl.svelte';
	import Select from '$components/forms/Select.svelte';
	import { SUPPORTED_CURRENCIES } from '$lib/types/domain';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let submitting = $state(false);

	const errors = $derived(form?.success === false ? form.errors : {});
	const values = $derived(form?.success === false ? form.values : {});

	const steps = [
		{ n: 1, label: 'How this works' },
		{ n: 2, label: 'Your basics' },
		{ n: 3, label: 'First data' }
	];

	const currencyOptions = SUPPORTED_CURRENCIES.map((c) => ({
		value: c.code,
		label: `${c.code} — ${c.name}`
	}));

	function field(name: string, fallback: string): string {
		return values[name] ?? fallback;
	}
</script>

<div class="ws-grid ws-grid--flush ws-grid--side wizard">
	<div class="ws-pad main">
		<ol class="steps">
			{#each steps as step (step.n)}
				<li class:done={step.n <= data.step}>
					<span class="step-n">Step {step.n}</span>
					<span class="step-label">{step.label}</span>
				</li>
			{/each}
		</ol>

		{#if errors._form}
			<ErrorMessage message={errors._form.join(' ')} />
		{/if}

		{#if data.step === 1}
			<h1>Welcome, {data.name}.</h1>
			<p class="lede">
				WealthScope records assets, investments, deposits, liabilities, income, expenses, interest,
				fees and taxes, then analyses net worth, allocation, liquidity, financial health, portfolio
				risk, concentration and future wealth.
			</p>

			<div class="pillars">
				<div>
					<h2>Stored on the server</h2>
					<p class="text-muted">
						Your records live in a database scoped to this account, so they are there on every
						device you sign in from. No other user can read them.
					</p>
				</div>
				<div>
					<h2>Yours to move</h2>
					<p class="text-muted">
						Full CSV export at any time, plus PDF statements. The export mirrors the import format,
						so a round trip loses nothing.
					</p>
				</div>
				<div>
					<h2>Exact arithmetic</h2>
					<p class="text-muted">
						Money is stored as exact decimals and computed with Decimal.js. What you enter is what
						is totalled, to the last unit.
					</p>
				</div>
			</div>

			<div class="ws-row">
				<a class="btn btn-primary" href="/welcome?step=2">Continue</a>
			</div>
		{:else if data.step === 2}
			<h2 class="heading">Set your basics</h2>
			<p class="text-muted lede">
				Four settings. Everything else is inferred from the records you enter, and all of it can
				change later in Settings.
			</p>

			<form
				method="POST"
				action="?/basics"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update({ reset: false });
						submitting = false;
					};
				}}
				novalidate
			>
				<div class="fields">
					<FormField
						id="onb-currency"
						label="Base currency"
						errors={errors.baseCurrency}
						hint="Every total is converted into this."
						required
					>
						{#snippet children({ id, describedBy, invalid })}
							<Select
								{id}
								name="baseCurrency"
								options={currencyOptions}
								required
								{invalid}
								{describedBy}
								value={field('baseCurrency', data.settings.baseCurrency)}
							/>
						{/snippet}
					</FormField>

					<FormField
						id="onb-birth"
						label="Year of birth"
						errors={errors.birthYear}
						hint="Used for milestone ages only. Leave it empty if you would rather not."
					>
						{#snippet children({ id, describedBy, invalid })}
							<NumberInput
								{id}
								name="birthYear"
								{invalid}
								{describedBy}
								align="right"
								value={field(
									'birthYear',
									data.settings.birthYear ? String(data.settings.birthYear) : ''
								)}
								placeholder=""
							/>
						{/snippet}
					</FormField>

					<FormField
						id="onb-retirement"
						label="Target retirement age"
						errors={errors.retirementAge}
					>
						{#snippet children({ id, describedBy, invalid })}
							<NumberInput
								{id}
								name="retirementAge"
								{invalid}
								{describedBy}
								align="right"
								value={field(
									'retirementAge',
									data.settings.retirementAge ? String(data.settings.retirementAge) : '62'
								)}
							/>
						{/snippet}
					</FormField>

					<div class="field">
						<span class="field-label" id="onb-ef-label">Emergency fund target</span>
						<div aria-labelledby="onb-ef-label">
							<SegmentedControl
								name="emergencyFundMonths"
								legend="Emergency fund target"
								options={[
									{ value: '3', label: '3 months' },
									{ value: '6', label: '6 months' },
									{ value: '12', label: '12 months' }
								]}
								value={field('emergencyFundMonths', String(data.settings.emergencyFundMonths))}
							/>
						</div>
						<p class="field-hint">The liquidity-cover score is graded against this.</p>
					</div>
				</div>

				<div class="ws-row">
					<Button variant="primary" type="submit" pending={submitting} pendingLabel="Saving…">
						Continue
					</Button>
					<a class="btn btn-secondary" href="/welcome?step=1">Back</a>
				</div>
			</form>
		{:else}
			<h2 class="heading">Get some data in</h2>
			<p class="text-muted lede">
				Pick one. You can mix all three later — imports append, they never overwrite.
			</p>

			<div class="choices">
				<div class="choice">
					<div>
						<h3>Import a CSV</h3>
						<p class="text-muted">
							Bank, broker or spreadsheet export. Map the columns once, review every row, then
							commit.
						</p>
					</div>
					<form method="POST" action="?/finish" use:enhance>
						<input type="hidden" name="next" value="/import" />
						<Button variant="secondary" type="submit">Go to import</Button>
					</form>
				</div>

				<div class="choice">
					<div>
						<h3>Set up your accounts</h3>
						<p class="text-muted">
							Start with the bank or broker your records sit in. Assigning an account is what makes
							the liquidity figures right.
						</p>
					</div>
					<form method="POST" action="?/finish" use:enhance>
						<input type="hidden" name="next" value="/accounts" />
						<Button variant="secondary" type="submit">Add an account</Button>
					</form>
				</div>

				<div class="choice">
					<div>
						<h3>Enter records by hand</h3>
						<p class="text-muted">
							Start with one property or one account balance; the dashboard fills in as you go.
						</p>
					</div>
					<form method="POST" action="?/finish" use:enhance>
						<input type="hidden" name="next" value="/assets" />
						<Button variant="primary" type="submit">Add an asset</Button>
					</form>
				</div>
			</div>

			<div class="ws-row">
				<a class="btn btn-secondary" href="/welcome?step=2">Back</a>
				<form method="POST" action="?/finish" use:enhance>
					<input type="hidden" name="next" value="/dashboard" />
					<Button variant="ghost" type="submit">Skip for now</Button>
				</form>
			</div>
		{/if}
	</div>

	<aside class="ws-pad notes">
		<h5>What happens next</h5>
		<p class="text-muted small">
			Nothing on this screen is irreversible. Every setting is editable in Settings, and every
			record can be edited or removed.
		</p>
		<div class="hr"></div>
		<h5>What is stored</h5>
		<p class="text-muted small">
			Your name, email and a password hash, plus the financial records you create. Uploaded CSV
			files are parsed and discarded — only the file name, size and a content hash are kept, so a
			repeat import can be flagged.
		</p>
		<div class="hr"></div>
		<p class="text-muted small">
			Deleting your account removes every record that belongs to it. Export first if you want a
			copy.
		</p>
	</aside>
</div>

<style>
	.wizard {
		min-height: 100%;
	}
	.main {
		padding: var(--space-8) var(--space-6);
		max-width: 860px;
	}
	.steps {
		display: flex;
		gap: var(--space-4);
		list-style: none;
		margin: 0 0 var(--space-6);
		padding: 0;
	}
	.steps li {
		flex: 1;
		border-top: 3px solid var(--color-divider);
		padding-top: 8px;
	}
	.steps li.done {
		border-top-color: var(--color-accent);
	}
	.step-n {
		display: block;
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-text) 45%, transparent);
	}
	.steps li.done .step-n {
		color: var(--color-accent-700);
	}
	.step-label {
		display: block;
		font-weight: 600;
		font-size: 13px;
	}
	h1 {
		font-size: var(--ws-display);
		margin-bottom: var(--space-3);
	}
	.heading {
		margin-bottom: var(--space-2);
	}
	.lede {
		font-size: 15px;
		max-width: 62ch;
	}
	.pillars {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-4);
		margin: var(--space-6) 0;
	}
	.pillars > div {
		border-top: 2px solid var(--color-divider);
		padding-top: var(--space-3);
	}
	.pillars h2 {
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: 15px;
		margin-bottom: 4px;
	}
	.pillars p {
		font-size: 12.5px;
		margin: 0;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin: var(--space-6) 0;
		max-width: 560px;
	}
	.choices {
		display: flex;
		flex-direction: column;
		margin: var(--space-6) 0;
	}
	.choice {
		border-top: 2px solid var(--color-divider);
		padding: var(--space-4) 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, auto);
		gap: var(--space-4);
		align-items: center;
	}
	.choice:last-child {
		border-bottom: 2px solid var(--color-divider);
	}
	.choice h3 {
		font-size: 16px;
		margin-bottom: 4px;
	}
	.choice p {
		font-size: 12.5px;
		margin: 0;
	}
	.notes {
		background: var(--color-surface);
	}
	.notes h5 {
		margin: 0 0 var(--space-3);
	}
	.small {
		font-size: 12.5px;
	}

	@media (max-width: 900px) {
		.pillars {
			grid-template-columns: 1fr;
		}
		.choice {
			grid-template-columns: 1fr;
		}
		.steps {
			gap: var(--space-2);
		}
	}
</style>
