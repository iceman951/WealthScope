import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { INVESTMENT_ASSET_TYPES, type AssetType } from '$lib/types/domain';
import type { AssetInputPayload } from '$lib/schemas/financial';
import type { AssetInput } from '$engine/types';
import type { DbClient } from '../db';
import { pageBounds, read } from '../db/read';
import { assetPrices, assets, financialAccounts } from '../db/schema';

export type AssetRow = typeof assets.$inferSelect;

/** The join the engine needs: an asset plus the account it sits in. */
const assetSelection = {
	id: assets.id,
	userId: assets.userId,
	name: assets.name,
	assetType: assets.assetType,
	symbol: assets.symbol,
	currency: assets.currency,
	quantity: assets.quantity,
	unitPrice: assets.unitPrice,
	manualValue: assets.manualValue,
	acquisitionCost: assets.acquisitionCost,
	valuationDate: assets.valuationDate,
	notes: assets.notes,
	accountId: assets.accountId,
	accountName: financialAccounts.name,
	accountType: financialAccounts.accountType,
	createdAt: assets.createdAt,
	updatedAt: assets.updatedAt
};

export type AssetWithAccount = Awaited<ReturnType<typeof listAssets>>[number];

export async function listAssets(
	userId: string,
	options: { assetTypes?: readonly AssetType[] } = {},
	db: DbClient = read()
) {
	const filters: SQL[] = [eq(assets.userId, userId)];
	if (options.assetTypes && options.assetTypes.length > 0) {
		filters.push(inArray(assets.assetType, [...options.assetTypes]));
	}

	return db
		.select(assetSelection)
		.from(assets)
		.leftJoin(financialAccounts, eq(assets.accountId, financialAccounts.id))
		.where(and(...filters))
		.orderBy(asc(assets.name));
}

export async function listAssetsPaged(
	userId: string,
	options: { assetType?: AssetType | null; page?: number; pageSize?: number } = {},
	db: DbClient = read()
) {
	const { limit, offset, page, pageSize } = pageBounds(options.page, options.pageSize);
	const filters: SQL[] = [eq(assets.userId, userId)];
	if (options.assetType) filters.push(eq(assets.assetType, options.assetType));
	const where = and(...filters);

	const [rows, totals] = await Promise.all([
		db
			.select(assetSelection)
			.from(assets)
			.leftJoin(financialAccounts, eq(assets.accountId, financialAccounts.id))
			.where(where)
			.orderBy(asc(assets.name))
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(assets).where(where)
	]);

	return { rows, total: totals[0]?.total ?? 0, page, pageSize };
}

/** Investment holdings only — the Investments screen's scope. */
export function listInvestments(userId: string, db: DbClient = read()) {
	return listAssets(userId, { assetTypes: INVESTMENT_ASSET_TYPES }, db);
}

export async function findAsset(userId: string, id: string, db: DbClient = read()) {
	const rows = await db
		.select(assetSelection)
		.from(assets)
		.leftJoin(financialAccounts, eq(assets.accountId, financialAccounts.id))
		.where(and(eq(assets.userId, userId), eq(assets.id, id)))
		.limit(1);
	return rows[0] ?? null;
}

export async function createAsset(userId: string, input: AssetInputPayload, db: DbClient = read()) {
	const rows = await db
		.insert(assets)
		.values({ ...input, userId })
		.returning();
	return rows[0];
}

export async function updateAsset(
	userId: string,
	id: string,
	input: AssetInputPayload,
	db: DbClient = read()
) {
	const rows = await db
		.update(assets)
		.set(input)
		.where(and(eq(assets.userId, userId), eq(assets.id, id)))
		.returning();
	return rows[0] ?? null;
}

export async function deleteAsset(userId: string, id: string, db: DbClient = read()) {
	const rows = await db
		.delete(assets)
		.where(and(eq(assets.userId, userId), eq(assets.id, id)))
		.returning({ id: assets.id });
	return rows.length > 0;
}

/** Distinct asset types the user actually holds, for the filter chips. */
export async function listAssetTypesInUse(userId: string, db: DbClient = read()) {
	const rows = await db
		.selectDistinct({ assetType: assets.assetType })
		.from(assets)
		.where(eq(assets.userId, userId));
	return rows.map((r) => r.assetType as AssetType);
}

/**
 * Price history for a set of assets, oldest first. One query for all of them
 * rather than one per holding.
 */
export async function listPriceHistory(
	userId: string,
	assetIds: readonly string[],
	db: DbClient = read()
) {
	if (assetIds.length === 0) return [];
	return db
		.select({
			assetId: assetPrices.assetId,
			priceDate: assetPrices.priceDate,
			price: assetPrices.price,
			currency: assetPrices.currency
		})
		.from(assetPrices)
		.innerJoin(assets, eq(assetPrices.assetId, assets.id))
		.where(and(eq(assets.userId, userId), inArray(assetPrices.assetId, [...assetIds])))
		.orderBy(asc(assetPrices.assetId), asc(assetPrices.priceDate));
}

export async function recordPrice(
	userId: string,
	input: { assetId: string; price: string; currency: string; priceDate: string },
	db: DbClient = read()
) {
	// The join guarantees the asset belongs to this user before anything is written.
	const owned = await db
		.select({ id: assets.id })
		.from(assets)
		.where(and(eq(assets.userId, userId), eq(assets.id, input.assetId)))
		.limit(1);
	if (owned.length === 0) return null;

	const rows = await db
		.insert(assetPrices)
		.values({ ...input, source: 'manual' })
		.onConflictDoUpdate({
			target: [assetPrices.assetId, assetPrices.priceDate, assetPrices.source],
			set: { price: input.price, currency: input.currency }
		})
		.returning();

	// The latest price is also the asset's working valuation.
	const latest = await db
		.select({ priceDate: assetPrices.priceDate })
		.from(assetPrices)
		.where(eq(assetPrices.assetId, input.assetId))
		.orderBy(desc(assetPrices.priceDate))
		.limit(1);

	if (latest[0]?.priceDate === input.priceDate) {
		await db
			.update(assets)
			.set({ unitPrice: input.price, valuationDate: input.priceDate })
			.where(and(eq(assets.userId, userId), eq(assets.id, input.assetId)));
	}

	return rows[0];
}

/** Total market value by asset type, computed in the database. */
export async function assetTotalsByType(userId: string, db: DbClient = read()) {
	return db
		.select({
			assetType: assets.assetType,
			currency: assets.currency,
			total: sql<string>`sum(coalesce(${assets.manualValue}, ${assets.quantity} * ${assets.unitPrice}))`
		})
		.from(assets)
		.where(eq(assets.userId, userId))
		.groupBy(assets.assetType, assets.currency);
}

/** Maps a repository row to the engine's input shape. */
export function toEngineAsset(row: AssetWithAccount): AssetInput {
	return {
		id: row.id,
		name: row.name,
		assetType: row.assetType as AssetType,
		symbol: row.symbol,
		currency: row.currency,
		quantity: row.quantity,
		unitPrice: row.unitPrice,
		manualValue: row.manualValue,
		acquisitionCost: row.acquisitionCost,
		valuationDate: row.valuationDate,
		accountId: row.accountId,
		accountName: row.accountName,
		accountType: (row.accountType as AssetInput['accountType']) ?? null
	};
}
