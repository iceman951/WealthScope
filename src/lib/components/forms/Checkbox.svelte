<script lang="ts">
	/** Uses the design system's `.radio` + `.dot` treatment for a square control. */
	interface Props {
		id: string;
		name: string;
		label: string;
		checked?: boolean;
		describedBy?: string;
		value?: string;
	}

	let { id, name, label, checked = false, describedBy, value = 'on' }: Props = $props();
</script>

<label class="radio" for={id}>
	<input type="checkbox" {id} {name} {value} {checked} aria-describedby={describedBy} />
	<span class="dot box" aria-hidden="true"></span>
	<span>{label}</span>
</label>

<style>
	.box {
		border-radius: 0;
	}
</style>
