import { z } from 'zod';
import {
	ACCOUNT_TYPES,
	ASSET_TYPES,
	CASHFLOW_CATEGORIES,
	CASHFLOW_ENTRY_TYPES,
	FREQUENCIES,
	GOAL_PRIORITIES,
	GOAL_STATUSES,
	GOAL_TYPES,
	LIABILITY_TYPES,
	TRANSACTION_TYPES
} from '$lib/types/domain';
import {
	checkboxSchema,
	currencyCodeSchema,
	enumOf,
	idSchema,
	isoDateSchema,
	moneySchema,
	nameSchema,
	notesSchema,
	optionalDateSchema,
	optionalIdSchema,
	optionalMoneySchema,
	optionalQuantitySchema,
	percentSchema,
	quantitySchema,
	symbolSchema
} from './common';

/**
 * Domain write schemas. These are the single definition of what a valid record
 * is; routes, services and the CSV importer all parse through them, so a rule
 * exists in exactly one place.
 */

export const accountInputSchema = z.object({
	name: nameSchema,
	accountType: enumOf(ACCOUNT_TYPES, 'Choose an account type'),
	institution: z
		.string()
		.trim()
		.max(160)
		.optional()
		.transform((v) => (v === undefined || v === '' ? null : v)),
	currency: currencyCodeSchema,
	description: notesSchema,
	isActive: checkboxSchema.default(true)
});
export type AccountInput = z.infer<typeof accountInputSchema>;

export const assetInputSchema = z
	.object({
		name: nameSchema,
		assetType: enumOf(ASSET_TYPES, 'Choose an asset type'),
		accountId: optionalIdSchema,
		symbol: symbolSchema,
		currency: currencyCodeSchema,
		quantity: quantitySchema('Quantity'),
		unitPrice: moneySchema('Unit price'),
		manualValue: optionalMoneySchema('Value'),
		acquisitionCost: optionalMoneySchema('Acquisition cost'),
		valuationDate: isoDateSchema,
		notes: notesSchema
	})
	.superRefine((value, ctx) => {
		// A record with neither a manual value nor a priced quantity has no value at
		// all, which would silently drop it out of every total.
		const hasManual = value.manualValue !== null;
		const hasPriced = value.quantity !== '0' && value.unitPrice !== '0';
		if (!hasManual && !hasPriced) {
			ctx.addIssue({
				code: 'custom',
				path: ['manualValue'],
				message: 'Enter a value, or a quantity and a unit price'
			});
		}
	});
export type AssetInputPayload = z.infer<typeof assetInputSchema>;

export const transactionInputSchema = z
	.object({
		accountId: idSchema,
		assetId: optionalIdSchema,
		transactionType: enumOf(TRANSACTION_TYPES, 'Choose a transaction type'),
		transactionDate: isoDateSchema,
		quantity: optionalQuantitySchema('Quantity'),
		unitPrice: optionalMoneySchema('Unit price'),
		grossAmount: moneySchema('Amount'),
		feeAmount: moneySchema('Fees').default('0'),
		taxAmount: moneySchema('Tax').default('0'),
		currency: currencyCodeSchema,
		exchangeRate: optionalMoneySchema('Exchange rate'),
		notes: notesSchema
	})
	.superRefine((value, ctx) => {
		if ((value.transactionType === 'buy' || value.transactionType === 'sell') && !value.assetId) {
			ctx.addIssue({
				code: 'custom',
				path: ['assetId'],
				message: 'A buy or sell must name the holding it applies to'
			});
		}
		if ((value.transactionType === 'buy' || value.transactionType === 'sell') && !value.quantity) {
			ctx.addIssue({
				code: 'custom',
				path: ['quantity'],
				message: 'A buy or sell must record a quantity'
			});
		}
	});
export type TransactionInputPayload = z.infer<typeof transactionInputSchema>;

export const liabilityInputSchema = z
	.object({
		name: nameSchema,
		liabilityType: enumOf(LIABILITY_TYPES, 'Choose a liability type'),
		accountId: optionalIdSchema,
		currency: currencyCodeSchema,
		originalPrincipal: moneySchema('Original principal'),
		outstandingBalance: moneySchema('Outstanding balance'),
		interestRate: percentSchema('Interest rate'),
		minimumPayment: optionalMoneySchema('Minimum payment'),
		monthlyPayment: optionalMoneySchema('Monthly payment'),
		startDate: optionalDateSchema,
		maturityDate: optionalDateSchema,
		notes: notesSchema
	})
	.superRefine((value, ctx) => {
		if (value.startDate && value.maturityDate && value.maturityDate < value.startDate) {
			ctx.addIssue({
				code: 'custom',
				path: ['maturityDate'],
				message: 'Maturity cannot fall before the start date'
			});
		}
	});
export type LiabilityInputPayload = z.infer<typeof liabilityInputSchema>;

export const cashflowInputSchema = z
	.object({
		entryType: enumOf(CASHFLOW_ENTRY_TYPES, 'Choose income or expense'),
		category: enumOf(CASHFLOW_CATEGORIES, 'Choose a category'),
		name: nameSchema,
		amount: moneySchema('Amount'),
		currency: currencyCodeSchema,
		frequency: enumOf(FREQUENCIES, 'Choose how often this occurs'),
		entryDate: isoDateSchema,
		endDate: optionalDateSchema,
		isRecurring: checkboxSchema.default(true),
		notes: notesSchema
	})
	.superRefine((value, ctx) => {
		if (value.endDate && value.endDate < value.entryDate) {
			ctx.addIssue({
				code: 'custom',
				path: ['endDate'],
				message: 'The end date cannot fall before the start date'
			});
		}
		if (value.isRecurring && value.frequency === 'once') {
			ctx.addIssue({
				code: 'custom',
				path: ['frequency'],
				message: 'A recurring entry needs a repeating frequency'
			});
		}
	});
export type CashflowInputPayload = z.infer<typeof cashflowInputSchema>;

export const goalInputSchema = z.object({
	name: nameSchema,
	goalType: enumOf(GOAL_TYPES, 'Choose a goal type'),
	targetAmount: moneySchema('Target amount'),
	currentAmount: moneySchema('Current amount').default('0'),
	currency: currencyCodeSchema,
	targetDate: optionalDateSchema,
	priority: enumOf(GOAL_PRIORITIES, 'Choose a priority').default('medium'),
	status: enumOf(GOAL_STATUSES, 'Choose a status').default('active'),
	notes: notesSchema
});
export type GoalInputPayload = z.infer<typeof goalInputSchema>;

export const exchangeRateInputSchema = z
	.object({
		baseCurrency: currencyCodeSchema,
		quoteCurrency: currencyCodeSchema,
		rate: moneySchema('Rate'),
		rateDate: isoDateSchema
	})
	.superRefine((value, ctx) => {
		if (value.baseCurrency === value.quoteCurrency) {
			ctx.addIssue({
				code: 'custom',
				path: ['quoteCurrency'],
				message: 'The two currencies must differ'
			});
		}
	});
export type ExchangeRateInputPayload = z.infer<typeof exchangeRateInputSchema>;

export const priceInputSchema = z.object({
	assetId: idSchema,
	price: moneySchema('Price'),
	currency: currencyCodeSchema,
	priceDate: isoDateSchema
});
export type PriceInputPayload = z.infer<typeof priceInputSchema>;

export const deleteSchema = z.object({ id: idSchema });
