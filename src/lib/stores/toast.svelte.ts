/**
 * Transient success/failure feedback.
 *
 * Deliberately tiny and client-only: it holds one message at a time and nothing
 * that came from the server.
 */

export interface ToastMessage {
	id: number;
	text: string;
	tone: 'success' | 'error';
}

let current = $state<ToastMessage | null>(null);
let counter = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

export function toastState() {
	return {
		get current() {
			return current;
		}
	};
}

export function showToast(text: string, tone: ToastMessage['tone'] = 'success'): void {
	counter += 1;
	current = { id: counter, text, tone };
	if (timer) clearTimeout(timer);
	timer = setTimeout(() => {
		current = null;
		timer = null;
	}, 4000);
}

export function dismissToast(): void {
	if (timer) clearTimeout(timer);
	timer = null;
	current = null;
}
