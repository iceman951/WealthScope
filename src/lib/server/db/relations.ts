import { relations } from 'drizzle-orm';
import { session, user } from './schema/auth';
import {
	assetPrices,
	assets,
	cashflowEntries,
	financialAccounts,
	financialGoals,
	importBatches,
	liabilities,
	portfolioSnapshots,
	transactions,
	userFinancialSettings
} from './schema/financial';

export const userRelations = relations(user, ({ many, one }) => ({
	sessions: many(session),
	accounts: many(financialAccounts),
	assets: many(assets),
	transactions: many(transactions),
	liabilities: many(liabilities),
	cashflowEntries: many(cashflowEntries),
	snapshots: many(portfolioSnapshots),
	goals: many(financialGoals),
	imports: many(importBatches),
	settings: one(userFinancialSettings, {
		fields: [user.id],
		references: [userFinancialSettings.userId]
	})
}));

export const financialAccountRelations = relations(financialAccounts, ({ one, many }) => ({
	user: one(user, { fields: [financialAccounts.userId], references: [user.id] }),
	assets: many(assets),
	transactions: many(transactions),
	liabilities: many(liabilities)
}));

export const assetRelations = relations(assets, ({ one, many }) => ({
	user: one(user, { fields: [assets.userId], references: [user.id] }),
	account: one(financialAccounts, {
		fields: [assets.accountId],
		references: [financialAccounts.id]
	}),
	prices: many(assetPrices),
	transactions: many(transactions)
}));

export const transactionRelations = relations(transactions, ({ one }) => ({
	user: one(user, { fields: [transactions.userId], references: [user.id] }),
	account: one(financialAccounts, {
		fields: [transactions.accountId],
		references: [financialAccounts.id]
	}),
	asset: one(assets, { fields: [transactions.assetId], references: [assets.id] }),
	importBatch: one(importBatches, {
		fields: [transactions.importBatchId],
		references: [importBatches.id]
	})
}));

export const liabilityRelations = relations(liabilities, ({ one }) => ({
	user: one(user, { fields: [liabilities.userId], references: [user.id] }),
	account: one(financialAccounts, {
		fields: [liabilities.accountId],
		references: [financialAccounts.id]
	})
}));

export const cashflowEntryRelations = relations(cashflowEntries, ({ one }) => ({
	user: one(user, { fields: [cashflowEntries.userId], references: [user.id] })
}));

export const assetPriceRelations = relations(assetPrices, ({ one }) => ({
	asset: one(assets, { fields: [assetPrices.assetId], references: [assets.id] })
}));

export const portfolioSnapshotRelations = relations(portfolioSnapshots, ({ one }) => ({
	user: one(user, { fields: [portfolioSnapshots.userId], references: [user.id] })
}));

export const financialGoalRelations = relations(financialGoals, ({ one }) => ({
	user: one(user, { fields: [financialGoals.userId], references: [user.id] })
}));

export const importBatchRelations = relations(importBatches, ({ one, many }) => ({
	user: one(user, { fields: [importBatches.userId], references: [user.id] }),
	transactions: many(transactions)
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] })
}));

export const userFinancialSettingsRelations = relations(userFinancialSettings, ({ one }) => ({
	user: one(user, { fields: [userFinancialSettings.userId], references: [user.id] })
}));
