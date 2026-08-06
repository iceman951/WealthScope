import { z } from 'zod';
import { SLEEVES } from '$lib/types/domain';
import { currencyCodeSchema, percentSchema } from './common';

export const settingsInputSchema = z.object({
	baseCurrency: currencyCodeSchema,
	locale: z
		.string()
		.trim()
		.regex(/^[a-zA-Z]{2}(-[a-zA-Z0-9]{2,8})*$/, { message: 'Use a locale tag such as th-TH' }),
	timezone: z.string().trim().min(1).max(64),
	fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
	defaultReturnAssumption: percentSchema('Expected return'),
	defaultInflationAssumption: percentSchema('Inflation'),
	emergencyFundMonths: z.coerce.number().int().min(1).max(36),
	displayDecimals: z.coerce
		.number()
		.int()
		.refine((v) => v === 0 || v === 2, {
			message: 'Rounding is either whole units or two decimal places'
		}),
	birthYear: z
		.string()
		.optional()
		.transform((v) => (v === undefined || v.trim() === '' ? null : Number(v)))
		.refine((v) => v === null || (Number.isInteger(v) && v >= 1900 && v <= 2100), {
			message: 'Enter a four-digit year'
		}),
	retirementAge: z
		.string()
		.optional()
		.transform((v) => (v === undefined || v.trim() === '' ? null : Number(v)))
		.refine((v) => v === null || (Number.isInteger(v) && v >= 30 && v <= 100), {
			message: 'Enter an age between 30 and 100'
		})
});
export type SettingsInput = z.infer<typeof settingsInputSchema>;

export const onboardingBasicsSchema = settingsInputSchema.pick({
	baseCurrency: true,
	birthYear: true,
	retirementAge: true,
	emergencyFundMonths: true
});
export type OnboardingBasics = z.infer<typeof onboardingBasicsSchema>;

export const projectionAssumptionsSchema = z.object({
	monthlyContribution: z.coerce.number().min(0).max(10_000_000),
	annualReturnPercent: z.coerce.number().min(0).max(20),
	annualInflationPercent: z.coerce.number().min(0).max(20),
	years: z.coerce.number().int().min(1).max(50),
	contributionGrowthPercent: z.coerce.number().min(0).max(20).default(0)
});
export type ProjectionAssumptionsInput = z.infer<typeof projectionAssumptionsSchema>;

export const sleeveTargetsSchema = z
	.record(z.enum(SLEEVES), z.coerce.number().min(0).max(100))
	.refine((targets) => Object.values(targets).reduce((acc, v) => acc + (v ?? 0), 0) <= 100.0001, {
		message: 'Target weights cannot add up to more than 100%'
	});
