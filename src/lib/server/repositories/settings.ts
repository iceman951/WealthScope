import { eq } from 'drizzle-orm';
import {
	DEFAULT_BASE_CURRENCY,
	DEFAULT_INFLATION_ASSUMPTION,
	DEFAULT_LOCALE,
	DEFAULT_RETURN_ASSUMPTION,
	DEFAULT_TIMEZONE
} from '$lib/types/domain';
import type { UserSettings } from '$lib/types/session';
import type { SettingsInput } from '$lib/schemas/settings';
import type { DbClient } from '../db';
import { read } from '../db/read';
import { userFinancialSettings } from '../db/schema';

export type SettingsRow = typeof userFinancialSettings.$inferSelect;

const FALLBACK: UserSettings = {
	baseCurrency: DEFAULT_BASE_CURRENCY,
	locale: DEFAULT_LOCALE,
	timezone: DEFAULT_TIMEZONE,
	fiscalYearStartMonth: 1,
	defaultReturnAssumption: DEFAULT_RETURN_ASSUMPTION,
	defaultInflationAssumption: DEFAULT_INFLATION_ASSUMPTION,
	emergencyFundMonths: 6,
	displayDecimals: 0,
	birthYear: null,
	retirementAge: null,
	onboardedAt: null
};

/**
 * Settings are created with the user, but a row can be missing if a user predates
 * this table. Returning documented defaults keeps every screen renderable rather
 * than failing a page load over a preference.
 */
export async function getSettings(userId: string, db: DbClient = read()): Promise<UserSettings> {
	const rows = await db
		.select()
		.from(userFinancialSettings)
		.where(eq(userFinancialSettings.userId, userId))
		.limit(1);

	const row = rows[0];
	if (!row) return { ...FALLBACK };

	return {
		baseCurrency: row.baseCurrency,
		locale: row.locale,
		timezone: row.timezone,
		fiscalYearStartMonth: row.fiscalYearStartMonth,
		defaultReturnAssumption: row.defaultReturnAssumption,
		defaultInflationAssumption: row.defaultInflationAssumption,
		emergencyFundMonths: row.emergencyFundMonths,
		displayDecimals: row.displayDecimals,
		birthYear: row.birthYear,
		retirementAge: row.retirementAge,
		onboardedAt: row.onboardedAt ? row.onboardedAt.toISOString() : null
	};
}

export async function upsertSettings(
	userId: string,
	input: Partial<SettingsInput> & { onboardedAt?: Date | null },
	db: DbClient = read()
) {
	const rows = await db
		.insert(userFinancialSettings)
		.values({ userId, ...input })
		.onConflictDoUpdate({ target: userFinancialSettings.userId, set: input })
		.returning();
	return rows[0];
}

export async function markOnboarded(userId: string, db: DbClient = read()) {
	await db
		.insert(userFinancialSettings)
		.values({ userId, onboardedAt: new Date() })
		.onConflictDoUpdate({
			target: userFinancialSettings.userId,
			set: { onboardedAt: new Date() }
		});
}
