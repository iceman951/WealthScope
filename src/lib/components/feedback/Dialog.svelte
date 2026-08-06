<script lang="ts">
	import { tick, type Snippet } from 'svelte';

	/**
	 * A modal dialog.
	 *
	 * Focus moves in on open and returns to the trigger on close, Tab is trapped
	 * inside, Escape dismisses, and the rest of the page is hidden from assistive
	 * tech while it is open.
	 */
	interface Props {
		open: boolean;
		title: string;
		/** Set false for a dialog that must be answered rather than dismissed. */
		dismissible?: boolean;
		width?: string;
		onclose: () => void;
		children: Snippet;
		actions?: Snippet;
	}

	let {
		open,
		title,
		dismissible = true,
		width = 'min(440px, 100%)',
		onclose,
		children,
		actions
	}: Props = $props();

	let dialogEl = $state<HTMLDivElement | null>(null);
	let previouslyFocused: HTMLElement | null = null;
	const titleId = `dialog-title-${Math.random().toString(36).slice(2, 8)}`;

	const FOCUSABLE =
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	$effect(() => {
		if (!open) return;

		previouslyFocused = document.activeElement as HTMLElement | null;
		const { body } = document;
		const previousOverflow = body.style.overflow;
		body.style.overflow = 'hidden';

		tick().then(() => {
			const first = dialogEl?.querySelector<HTMLElement>(FOCUSABLE);
			(first ?? dialogEl)?.focus();
		});

		return () => {
			body.style.overflow = previousOverflow;
			previouslyFocused?.focus?.();
		};
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && dismissible) {
			event.preventDefault();
			onclose();
			return;
		}
		if (event.key !== 'Tab' || !dialogEl) return;

		const focusable = [...dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
			(el) => el.offsetParent !== null || el === document.activeElement
		);
		if (focusable.length === 0) {
			event.preventDefault();
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	function onBackdropClick(event: MouseEvent) {
		if (dismissible && event.target === event.currentTarget) onclose();
	}
</script>

<svelte:window onkeydown={open ? onKeydown : undefined} />

{#if open}
	<!-- The backdrop is a click target for dismissal; keyboard users use Escape,
	     which is handled on window above. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="dialog-backdrop" onclick={onBackdropClick}>
		<div
			class="dialog"
			style="width:{width}"
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			tabindex="-1"
			bind:this={dialogEl}
		>
			<h2 class="dialog-title" id={titleId}>{title}</h2>
			{@render children()}
			{#if actions}
				<div class="dialog-actions">{@render actions()}</div>
			{/if}
		</div>
	</div>
{/if}
