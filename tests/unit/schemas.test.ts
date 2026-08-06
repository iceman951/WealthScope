import { describe, expect, it } from 'vitest';
import {
	currencyCodeSchema,
	fieldErrors,
	isoDateSchema,
	moneySchema,
	optionalMoneySchema,
	percentSchema,
	quantitySchema
} from '../../src/lib/schemas/common';
import {
	assetInputSchema,
	cashflowInputSchema,
	liabilityInputSchema,
	transactionInputSchema
} from '../../src/lib/schemas/financial';
import { loginSchema, passwordSchema, registerSchema } from '../../src/lib/schemas/auth';

describe('currencyCodeSchema', () => {
	it('upper-cases and trims', () => {
		expect(currencyCodeSchema.parse(' thb ')).toBe('THB');
	});

	it('rejects anything that is not three letters', () => {
		expect(currencyCodeSchema.safeParse('THBX').success).toBe(false);
		expect(currencyCodeSchema.safeParse('12A').success).toBe(false);
	});
});

describe('isoDateSchema', () => {
	it('accepts a real date', () => {
		expect(isoDateSchema.parse('2026-08-01')).toBe('2026-08-01');
	});

	it('rejects a malformed or impossible date', () => {
		expect(isoDateSchema.safeParse('01/08/2026').success).toBe(false);
		expect(isoDateSchema.safeParse('2026-13-01').success).toBe(false);
	});
});

describe('moneySchema', () => {
	const schema = moneySchema('Amount');

	it('normalises what a user actually types', () => {
		expect(schema.parse('1,234.56')).toBe('1234.56');
		expect(schema.parse(' 1 000 ')).toBe('1000');
		expect(schema.parse('$2,500')).toBe('2500');
	});

	it('rejects a non-number with a field-specific message', () => {
		const result = schema.safeParse('abc');
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error.issues[0].message).toContain('Amount');
	});

	it('rejects a negative by default', () => {
		expect(schema.safeParse('-100').success).toBe(false);
	});

	it('allows a negative when the field permits one', () => {
		expect(moneySchema('Adjustment', true).parse('-100')).toBe('-100');
		// The design uses a true minus sign; it must round-trip.
		expect(moneySchema('Adjustment', true).parse('−100')).toBe('-100');
	});

	it('rejects more decimal places than the column stores', () => {
		expect(schema.safeParse('1.123456789').success).toBe(false);
	});

	it('rejects a value beyond the supported magnitude', () => {
		expect(schema.safeParse('999999999999999999999').success).toBe(false);
	});

	it('accepts zero', () => {
		expect(schema.parse('0')).toBe('0');
	});

	it('rejects an empty field', () => {
		expect(schema.safeParse('').success).toBe(false);
	});
});

describe('optionalMoneySchema', () => {
	const schema = optionalMoneySchema('Cost');

	it('treats an empty field as "not recorded", not zero', () => {
		expect(schema.parse('')).toBeNull();
		expect(schema.parse(undefined)).toBeNull();
	});

	it('still validates a supplied value', () => {
		expect(schema.parse('1,500')).toBe('1500');
		expect(schema.safeParse('abc').success).toBe(false);
	});
});

describe('quantitySchema / percentSchema', () => {
	it('allows twelve decimal places on a quantity', () => {
		expect(quantitySchema('Quantity').parse('0.000000000001')).toBe('0.000000000001');
	});

	it('caps a percentage at a sane magnitude', () => {
		expect(percentSchema('Rate').safeParse('99999').success).toBe(false);
	});
});

describe('assetInputSchema', () => {
	const valid = {
		name: 'Savings',
		assetType: 'cash',
		currency: 'THB',
		quantity: '1',
		unitPrice: '1000',
		valuationDate: '2026-08-01'
	};

	it('accepts a valid record', () => {
		expect(assetInputSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects a record with no value at all', () => {
		const result = assetInputSchema.safeParse({ ...valid, quantity: '0', unitPrice: '0' });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(fieldErrors(result.error).manualValue?.[0]).toContain('Enter a value');
		}
	});

	it('accepts a manual valuation with no unit price', () => {
		const result = assetInputSchema.safeParse({
			...valid,
			quantity: '0',
			unitPrice: '0',
			manualValue: '8400000'
		});
		expect(result.success).toBe(true);
	});

	it('rejects an unknown asset class', () => {
		expect(assetInputSchema.safeParse({ ...valid, assetType: 'unicorns' }).success).toBe(false);
	});
});

describe('transactionInputSchema', () => {
	const base = {
		accountId: '00000000-0000-4000-8000-000000000001',
		transactionType: 'buy',
		transactionDate: '2026-08-01',
		grossAmount: '1000',
		currency: 'THB'
	};

	it('requires a holding and a quantity for a buy', () => {
		const result = transactionInputSchema.safeParse(base);
		expect(result.success).toBe(false);
		if (!result.success) {
			const errors = fieldErrors(result.error);
			expect(errors.assetId).toBeDefined();
			expect(errors.quantity).toBeDefined();
		}
	});

	it('does not require a holding for a deposit', () => {
		expect(transactionInputSchema.safeParse({ ...base, transactionType: 'deposit' }).success).toBe(
			true
		);
	});
});

describe('liabilityInputSchema', () => {
	const valid = {
		name: 'Mortgage',
		liabilityType: 'mortgage',
		currency: 'THB',
		originalPrincipal: '5600000',
		outstandingBalance: '4180000',
		interestRate: '3.4'
	};

	it('accepts a valid liability', () => {
		expect(liabilityInputSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects a maturity before the start date', () => {
		const result = liabilityInputSchema.safeParse({
			...valid,
			startDate: '2026-01-01',
			maturityDate: '2025-01-01'
		});
		expect(result.success).toBe(false);
		if (!result.success) expect(fieldErrors(result.error).maturityDate).toBeDefined();
	});
});

describe('cashflowInputSchema', () => {
	const valid = {
		entryType: 'income',
		category: 'salary',
		name: 'Salary',
		amount: '100000',
		currency: 'THB',
		frequency: 'monthly',
		entryDate: '2026-01-01',
		isRecurring: 'on'
	};

	it('accepts a valid entry', () => {
		expect(cashflowInputSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects a recurring entry with a one-off frequency', () => {
		const result = cashflowInputSchema.safeParse({ ...valid, frequency: 'once' });
		expect(result.success).toBe(false);
		if (!result.success) expect(fieldErrors(result.error).frequency).toBeDefined();
	});

	it('rejects an end date before the start', () => {
		const result = cashflowInputSchema.safeParse({
			...valid,
			endDate: '2025-01-01'
		});
		expect(result.success).toBe(false);
	});
});

describe('auth schemas', () => {
	it('requires a long password rather than a complex one', () => {
		expect(passwordSchema.safeParse('short').success).toBe(false);
		expect(passwordSchema.safeParse('correct horse battery staple').success).toBe(true);
	});

	it('rejects mismatched confirmation', () => {
		const result = registerSchema.safeParse({
			name: 'Alex',
			email: 'alex@example.com',
			password: 'a-very-long-password',
			confirmPassword: 'something-else-entirely'
		});
		expect(result.success).toBe(false);
		if (!result.success) expect(fieldErrors(result.error).confirmPassword).toBeDefined();
	});

	it('normalises the email address', () => {
		const result = loginSchema.parse({ email: '  ALEX@Example.COM ', password: 'x' });
		expect(result.email).toBe('alex@example.com');
	});
});

describe('fieldErrors', () => {
	it('keys messages by field path', () => {
		const result = registerSchema.safeParse({
			name: '',
			email: 'nope',
			password: 'x',
			confirmPassword: 'y'
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			const errors = fieldErrors(result.error);
			expect(errors.name).toBeDefined();
			expect(errors.email).toBeDefined();
		}
	});
});
