import type { Transport } from '@sveltejs/kit';
import { Decimal } from '$engine/money';

/**
 * Universal hooks.
 *
 * Teaching SvelteKit to serialise Decimal means a load function can return exact
 * engine results directly, and the browser receives Decimals rather than floats.
 * Without this the values would have to be stringified at every boundary, and one
 * missed conversion would silently reintroduce binary floating point.
 */
export const transport: Transport = {
	Decimal: {
		encode: (value) => value instanceof Decimal && value.toString(),
		decode: (value) => new Decimal(value as string)
	}
};
