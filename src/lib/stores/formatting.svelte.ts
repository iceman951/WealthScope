import { getContext, setContext } from 'svelte';
import { dec, formatMoney, formatPercent, type DecimalInput } from '$engine/money';
import type { UserSettings } from '$lib/types/session';

/**
 * Display formatting, carried through context rather than a global store.
 *
 * Server data is not duplicated into a client store: the settings object arrives
 * with the layout's page data and this wraps it. One instance per rendered tree,
 * which is also what makes SSR safe.
 */

const KEY = Symbol('wealthscope.formatters');

export interface Formatters {
	readonly settings: UserSettings;
	money: (
		value: DecimalInput,
		options?: { currency?: string; signed?: boolean; bare?: boolean; decimals?: number }
	) => string;
	percent: (value: DecimalInput, decimals?: number, signed?: boolean) => string;
	date: (iso: string) => string;
	/** 'up' | 'down' | 'none' — pairs with a sign, never used as the only signal. */
	direction: (value: DecimalInput) => 'up' | 'down' | 'none';
}

/**
 * Takes a getter rather than a value so the formatters follow the layout's page
 * data: changing the base currency in Settings reformats every screen without a
 * second copy of the settings living in a store.
 */
export function createFormatters(read: () => UserSettings): Formatters {
	return {
		get settings() {
			return read();
		},
		money: (value, options = {}) => {
			const settings = read();
			return formatMoney(value, options.currency ?? settings.baseCurrency, {
				locale: settings.locale,
				decimals: options.decimals ?? settings.displayDecimals,
				signed: options.signed,
				bare: options.bare
			});
		},
		percent: (value, decimals = 1, signed = false) => formatPercent(value, { decimals, signed }),
		date: (iso) => {
			const parsed = Date.parse(`${iso}T00:00:00Z`);
			if (Number.isNaN(parsed)) return iso;
			return new Intl.DateTimeFormat(read().locale, {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				timeZone: 'UTC'
			}).format(parsed);
		},
		direction: (value) => {
			const d = dec(value);
			if (d.isZero()) return 'none';
			return d.isNegative() ? 'down' : 'up';
		}
	};
}

export function provideFormatters(read: () => UserSettings): Formatters {
	const formatters = createFormatters(read);
	setContext(KEY, formatters);
	return formatters;
}

/**
 * Falls back to a neutral formatter so a component rendered outside the app shell
 * (a report preview, a test) still produces readable output instead of crashing.
 */
export function getFormatters(): Formatters {
	return (
		getContext<Formatters | undefined>(KEY) ??
		createFormatters(() => ({
			baseCurrency: 'THB',
			locale: 'th-TH',
			timezone: 'Asia/Bangkok',
			fiscalYearStartMonth: 1,
			defaultReturnAssumption: '6',
			defaultInflationAssumption: '2.2',
			emergencyFundMonths: 6,
			displayDecimals: 0,
			birthYear: null,
			retirementAge: null,
			onboardedAt: null
		}))
	);
}
