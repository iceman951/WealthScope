import { describe, expect, it } from 'vitest';
import {
	Decimal,
	barWidth,
	currencyDecimals,
	dec,
	divide,
	formatMoney,
	formatOptionalPercent,
	formatPercent,
	formatQuantity,
	maxOf,
	percentOf,
	sum,
	sumBy,
	toStorage,
	tryDec
} from '../../src/lib/engine/money';

describe('dec', () => {
	it('parses exact decimal strings without float drift', () => {
		expect(dec('0.1').plus(dec('0.2')).toString()).toBe('0.3');
		expect(0.1 + 0.2).not.toBe(0.3); // the reason the whole engine exists
	});

	it('collapses missing values to zero rather than NaN', () => {
		expect(dec(null).toString()).toBe('0');
		expect(dec(undefined).toString()).toBe('0');
		expect(dec('').toString()).toBe('0');
		expect(dec('not a number').toString()).toBe('0');
		expect(dec(Number.NaN).toString()).toBe('0');
		expect(dec(Number.POSITIVE_INFINITY).toString()).toBe('0');
	});

	it('keeps very large values exact', () => {
		const huge = '9999999999999999.99999999';
		expect(dec(huge).toString()).toBe(huge);
	});

	it('keeps many decimal places', () => {
		expect(dec('0.000000000001').times(1000).toString()).toBe('0.000000001');
	});
});

describe('tryDec', () => {
	it('reports unparseable input instead of hiding it', () => {
		expect(tryDec('12.5')?.toString()).toBe('12.5');
		expect(tryDec('abc')).toBeNull();
		expect(tryDec('')).toBeNull();
		expect(tryDec(null)).toBeNull();
	});
});

describe('sum', () => {
	it('adds exactly', () => {
		expect(sum(['0.1', '0.2', '0.3']).toString()).toBe('0.6');
	});

	it('returns zero for an empty list', () => {
		expect(sum([]).toString()).toBe('0');
	});

	it('handles negatives', () => {
		expect(sum(['100', '-40.5']).toString()).toBe('59.5');
	});
});

describe('sumBy / maxOf', () => {
	it('sums a projected field', () => {
		expect(sumBy([{ v: '1.1' }, { v: '2.2' }], (x) => x.v).toString()).toBe('3.3');
	});

	it('finds the maximum', () => {
		expect(maxOf(['3', '9.5', '-2']).toString()).toBe('9.5');
		expect(maxOf([]).toString()).toBe('0');
	});
});

describe('divide', () => {
	it('returns null on a zero denominator rather than Infinity', () => {
		expect(divide('10', '0')).toBeNull();
		expect(divide('0', '0')).toBeNull();
	});

	it('divides exactly', () => {
		expect(divide('10', '4')?.toString()).toBe('2.5');
	});
});

describe('percentOf', () => {
	it('computes a share', () => {
		expect(percentOf('25', '200')?.toString()).toBe('12.5');
	});

	it('returns null when the total is zero', () => {
		expect(percentOf('25', '0')).toBeNull();
	});

	it('handles a part larger than the total', () => {
		expect(percentOf('300', '200')?.toString()).toBe('150');
	});
});

describe('toStorage', () => {
	it('renders at the column scale', () => {
		expect(toStorage('1.5')).toBe('1.50000000');
		expect(toStorage(0)).toBe('0.00000000');
	});

	it('rounds half to even, so repeated rounding does not drift upward', () => {
		expect(toStorage('0.000000005')).toBe('0.00000000');
		expect(toStorage('0.000000015')).toBe('0.00000002');
	});
});

describe('currencyDecimals', () => {
	it('knows zero-decimal currencies', () => {
		expect(currencyDecimals('JPY')).toBe(0);
		expect(currencyDecimals('jpy')).toBe(0);
		expect(currencyDecimals('THB')).toBe(2);
	});
});

describe('formatMoney', () => {
	it('formats with the currency symbol', () => {
		const result = formatMoney('1234.5', 'USD', { locale: 'en-US', decimals: 2 });
		expect(result).toContain('1,234.50');
	});

	it('uses a true minus sign for negatives, as the design does', () => {
		const result = formatMoney('-500', 'USD', { locale: 'en-US', decimals: 0 });
		expect(result.startsWith('−')).toBe(true);
		expect(result).not.toContain('-');
	});

	it('adds an explicit plus when asked', () => {
		expect(formatMoney('500', 'USD', { locale: 'en-US', decimals: 0, signed: true })).toContain(
			'+'
		);
		// Zero is neither a gain nor a loss, so it carries no sign.
		expect(formatMoney('0', 'USD', { locale: 'en-US', decimals: 0, signed: true })).not.toContain(
			'+'
		);
	});

	it('rounds at the display boundary only', () => {
		expect(formatMoney('1234.567', 'USD', { locale: 'en-US', decimals: 2 })).toContain('1,234.57');
		expect(formatMoney('1234.567', 'USD', { locale: 'en-US', decimals: 0 })).toContain('1,235');
	});

	it('still renders an unfamiliar currency code readably', () => {
		// Intl separates the code from the amount with a non-breaking space.
		const result = formatMoney('10', 'ZZZ', { locale: 'en-US', decimals: 2 }).replace(/\s/g, ' ');
		expect(result).toBe('ZZZ 10.00');
	});

	it('omits the symbol in bare mode', () => {
		expect(formatMoney('1000', 'THB', { locale: 'en-US', decimals: 0, bare: true })).toBe('1,000');
	});
});

describe('formatPercent', () => {
	it('formats with one decimal by default', () => {
		expect(formatPercent('12.345')).toBe('12.3%');
	});

	it('uses a true minus sign', () => {
		expect(formatPercent('-4.2')).toBe('−4.2%');
	});

	it('signs positives when asked', () => {
		expect(formatPercent('4.2', { signed: true })).toBe('+4.2%');
	});
});

describe('formatOptionalPercent', () => {
	it('shows an em dash rather than a zero for missing data', () => {
		expect(formatOptionalPercent(null)).toBe('—');
		expect(formatOptionalPercent(undefined)).toBe('—');
		expect(formatOptionalPercent(new Decimal(0))).toBe('0.0%');
	});
});

describe('formatQuantity', () => {
	it('trims trailing zeros but keeps the places in use', () => {
		expect(formatQuantity('412.000000')).toBe('412');
		expect(formatQuantity('0.00500000')).toBe('0.005');
	});
});

describe('barWidth', () => {
	it('clamps to the drawable range', () => {
		expect(barWidth(new Decimal(150))).toBe(100);
		expect(barWidth(new Decimal(-10))).toBe(0);
		expect(barWidth(null)).toBe(0);
		expect(barWidth(new Decimal('33.333'))).toBeCloseTo(33.33, 2);
	});
});
