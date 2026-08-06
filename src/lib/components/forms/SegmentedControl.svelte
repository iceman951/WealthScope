<script lang="ts">
	/**
	 * The design's `.seg` control: a native radio group styled as segments, so it
	 * is keyboard-navigable and submits with the form without any script.
	 */
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		name: string;
		options: readonly Option[];
		value?: string;
		legend?: string;
		onchange?: (event: Event) => void;
	}

	let { name, options, value = '', legend, onchange }: Props = $props();
</script>

<fieldset class="seg-group">
	{#if legend}<legend class="visually-hidden">{legend}</legend>{/if}
	<div class="seg">
		{#each options as option (option.value)}
			<label class="seg-opt">
				<input
					type="radio"
					{name}
					value={option.value}
					checked={option.value === value}
					{onchange}
				/>
				<span>{option.label}</span>
			</label>
		{/each}
	</div>
</fieldset>

<style>
	.seg-group {
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}
</style>
