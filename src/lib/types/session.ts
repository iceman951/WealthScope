import type { SleeveTargets } from './domain';

/** The shape of the authenticated user exposed through `event.locals`. */
export interface AuthenticatedUser {
	id: string;
	email: string;
	name: string;
	emailVerified: boolean;
	image?: string | null;
}

/** Display settings safe to hand to the browser. */
export interface UserSettings {
	baseCurrency: string;
	locale: string;
	timezone: string;
	fiscalYearStartMonth: number;
	defaultReturnAssumption: string;
	defaultInflationAssumption: string;
	emergencyFundMonths: number;
	displayDecimals: number;
	birthYear: number | null;
	retirementAge: number | null;
	/** Null when the user has not set any; DEFAULT_SLEEVE_TARGETS then applies. */
	sleeveTargets: SleeveTargets | null;
	onboardedAt: string | null;
}
