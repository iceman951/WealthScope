CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_token_idx` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `user_email_idx` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `asset_prices` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`price` text NOT NULL,
	`currency` text(3) NOT NULL,
	`price_date` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "asset_prices_source_chk" CHECK("source" IN ('manual', 'import', 'provider')),
	CONSTRAINT "asset_prices_currency_chk" CHECK("currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "asset_prices_price_chk" CHECK(CAST("price" AS REAL) >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_prices_unique` ON `asset_prices` (`asset_id`,`price_date`,`source`);--> statement-breakpoint
CREATE INDEX `asset_prices_asset_date_idx` ON `asset_prices` (`asset_id`,`price_date`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text,
	`name` text(160) NOT NULL,
	`asset_type` text NOT NULL,
	`symbol` text(32),
	`currency` text(3) NOT NULL,
	`quantity` text DEFAULT '1' NOT NULL,
	`unit_price` text DEFAULT '0' NOT NULL,
	`manual_value` text,
	`acquisition_cost` text,
	`valuation_date` text NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `financial_accounts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "assets_type_chk" CHECK("asset_type" IN ('cash', 'stock', 'etf', 'bond', 'fund', 'crypto', 'property', 'vehicle', 'business', 'collectible', 'other')),
	CONSTRAINT "assets_currency_chk" CHECK("currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "assets_quantity_chk" CHECK(CAST("quantity" AS REAL) >= 0),
	CONSTRAINT "assets_unit_price_chk" CHECK(CAST("unit_price" AS REAL) >= 0)
);
--> statement-breakpoint
CREATE INDEX `assets_user_idx` ON `assets` (`user_id`);--> statement-breakpoint
CREATE INDEX `assets_user_type_idx` ON `assets` (`user_id`,`asset_type`);--> statement-breakpoint
CREATE INDEX `assets_account_idx` ON `assets` (`account_id`);--> statement-breakpoint
CREATE INDEX `assets_symbol_idx` ON `assets` (`symbol`);--> statement-breakpoint
CREATE INDEX `assets_currency_idx` ON `assets` (`currency`);--> statement-breakpoint
CREATE INDEX `assets_user_valuation_idx` ON `assets` (`user_id`,`valuation_date`);--> statement-breakpoint
CREATE TABLE `cashflow_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entry_type` text NOT NULL,
	`category` text NOT NULL,
	`name` text(160) NOT NULL,
	`amount` text NOT NULL,
	`currency` text(3) NOT NULL,
	`frequency` text NOT NULL,
	`entry_date` text NOT NULL,
	`end_date` text,
	`is_recurring` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cashflow_entry_type_chk" CHECK("entry_type" IN ('income', 'expense')),
	CONSTRAINT "cashflow_category_chk" CHECK("category" IN ('salary', 'business', 'rental', 'dividends', 'interest', 'pension', 'other_income', 'housing', 'living', 'taxes', 'education', 'transport', 'insurance', 'fees', 'debt_service', 'other_expense')),
	CONSTRAINT "cashflow_frequency_chk" CHECK("frequency" IN ('once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual')),
	CONSTRAINT "cashflow_currency_chk" CHECK("currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "cashflow_amount_chk" CHECK(CAST("amount" AS REAL) >= 0)
);
--> statement-breakpoint
CREATE INDEX `cashflow_user_idx` ON `cashflow_entries` (`user_id`);--> statement-breakpoint
CREATE INDEX `cashflow_user_type_idx` ON `cashflow_entries` (`user_id`,`entry_type`);--> statement-breakpoint
CREATE INDEX `cashflow_user_date_idx` ON `cashflow_entries` (`user_id`,`entry_date`);--> statement-breakpoint
CREATE INDEX `cashflow_currency_idx` ON `cashflow_entries` (`currency`);--> statement-breakpoint
CREATE TABLE `exchange_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`base_currency` text(3) NOT NULL,
	`quote_currency` text(3) NOT NULL,
	`rate` text NOT NULL,
	`rate_date` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "exchange_rates_base_chk" CHECK("base_currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "exchange_rates_quote_chk" CHECK("quote_currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "exchange_rates_rate_chk" CHECK(CAST(rate AS REAL) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exchange_rates_unique` ON `exchange_rates` (`base_currency`,`quote_currency`,`rate_date`,`source`);--> statement-breakpoint
CREATE INDEX `exchange_rates_pair_date_idx` ON `exchange_rates` (`base_currency`,`quote_currency`,`rate_date`);--> statement-breakpoint
CREATE TABLE `financial_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text(160) NOT NULL,
	`account_type` text NOT NULL,
	`institution` text(160),
	`currency` text(3) NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "financial_accounts_type_chk" CHECK("account_type" IN ('cash', 'bank', 'brokerage', 'retirement', 'crypto', 'property', 'loan', 'credit', 'other')),
	CONSTRAINT "financial_accounts_currency_chk" CHECK("currency" GLOB '[A-Z][A-Z][A-Z]')
);
--> statement-breakpoint
CREATE INDEX `financial_accounts_user_idx` ON `financial_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `financial_accounts_user_type_idx` ON `financial_accounts` (`user_id`,`account_type`);--> statement-breakpoint
CREATE INDEX `financial_accounts_currency_idx` ON `financial_accounts` (`currency`);--> statement-breakpoint
CREATE TABLE `financial_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text(160) NOT NULL,
	`goal_type` text NOT NULL,
	`target_amount` text NOT NULL,
	`current_amount` text DEFAULT '0' NOT NULL,
	`currency` text(3) NOT NULL,
	`target_date` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "financial_goals_type_chk" CHECK("goal_type" IN ('emergency_fund', 'retirement', 'property', 'education', 'debt_payoff', 'travel', 'other')),
	CONSTRAINT "financial_goals_status_chk" CHECK("status" IN ('active', 'achieved', 'paused', 'abandoned')),
	CONSTRAINT "financial_goals_priority_chk" CHECK("priority" IN ('low', 'medium', 'high')),
	CONSTRAINT "financial_goals_currency_chk" CHECK("currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "financial_goals_target_chk" CHECK(CAST(target_amount AS REAL) > 0)
);
--> statement-breakpoint
CREATE INDEX `financial_goals_user_idx` ON `financial_goals` (`user_id`);--> statement-breakpoint
CREATE INDEX `financial_goals_user_status_idx` ON `financial_goals` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `financial_goals_user_target_date_idx` ON `financial_goals` (`user_id`,`target_date`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`file_name` text(255) NOT NULL,
	`file_size` integer NOT NULL,
	`content_hash` text(64) NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`imported_count` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_summary` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "import_batches_kind_chk" CHECK("kind" IN ('assets', 'transactions', 'liabilities', 'cashflow')),
	CONSTRAINT "import_batches_status_chk" CHECK("status" IN ('pending', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `import_batches_user_idx` ON `import_batches` (`user_id`);--> statement-breakpoint
CREATE INDEX `import_batches_user_hash_idx` ON `import_batches` (`user_id`,`content_hash`);--> statement-breakpoint
CREATE TABLE `liabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text,
	`name` text(160) NOT NULL,
	`liability_type` text NOT NULL,
	`currency` text(3) NOT NULL,
	`original_principal` text NOT NULL,
	`outstanding_balance` text NOT NULL,
	`interest_rate` text NOT NULL,
	`minimum_payment` text,
	`monthly_payment` text,
	`start_date` text,
	`maturity_date` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `financial_accounts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "liabilities_type_chk" CHECK("liability_type" IN ('mortgage', 'auto_loan', 'student_loan', 'personal_loan', 'credit_card', 'line_of_credit', 'business_loan', 'other')),
	CONSTRAINT "liabilities_currency_chk" CHECK("currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "liabilities_balance_chk" CHECK(CAST("outstanding_balance" AS REAL) >= 0),
	CONSTRAINT "liabilities_principal_chk" CHECK(CAST("original_principal" AS REAL) >= 0),
	CONSTRAINT "liabilities_rate_chk" CHECK(CAST("interest_rate" AS REAL) >= 0)
);
--> statement-breakpoint
CREATE INDEX `liabilities_user_idx` ON `liabilities` (`user_id`);--> statement-breakpoint
CREATE INDEX `liabilities_user_type_idx` ON `liabilities` (`user_id`,`liability_type`);--> statement-breakpoint
CREATE INDEX `liabilities_account_idx` ON `liabilities` (`account_id`);--> statement-breakpoint
CREATE INDEX `liabilities_currency_idx` ON `liabilities` (`currency`);--> statement-breakpoint
CREATE INDEX `liabilities_user_maturity_idx` ON `liabilities` (`user_id`,`maturity_date`);--> statement-breakpoint
CREATE TABLE `portfolio_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`snapshot_date` text NOT NULL,
	`base_currency` text(3) NOT NULL,
	`total_assets` text NOT NULL,
	`total_liabilities` text NOT NULL,
	`net_worth` text NOT NULL,
	`liquid_assets` text NOT NULL,
	`investment_assets` text NOT NULL,
	`metadata_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "portfolio_snapshots_currency_chk" CHECK("base_currency" GLOB '[A-Z][A-Z][A-Z]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portfolio_snapshots_user_date_unique` ON `portfolio_snapshots` (`user_id`,`snapshot_date`);--> statement-breakpoint
CREATE INDEX `portfolio_snapshots_user_date_idx` ON `portfolio_snapshots` (`user_id`,`snapshot_date`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`asset_id` text,
	`transaction_type` text NOT NULL,
	`transaction_date` text NOT NULL,
	`quantity` text,
	`unit_price` text,
	`gross_amount` text NOT NULL,
	`fee_amount` text DEFAULT '0' NOT NULL,
	`tax_amount` text DEFAULT '0' NOT NULL,
	`currency` text(3) NOT NULL,
	`exchange_rate` text,
	`notes` text,
	`import_batch_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `financial_accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transactions_type_chk" CHECK("transaction_type" IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'interest', 'fee', 'tax', 'transfer', 'adjustment')),
	CONSTRAINT "transactions_currency_chk" CHECK("currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "transactions_fee_chk" CHECK(CAST("fee_amount" AS REAL) >= 0),
	CONSTRAINT "transactions_tax_chk" CHECK(CAST("tax_amount" AS REAL) >= 0)
);
--> statement-breakpoint
CREATE INDEX `transactions_user_idx` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `transactions_user_date_idx` ON `transactions` (`user_id`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `transactions_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_asset_idx` ON `transactions` (`asset_id`);--> statement-breakpoint
CREATE INDEX `transactions_user_type_idx` ON `transactions` (`user_id`,`transaction_type`);--> statement-breakpoint
CREATE INDEX `transactions_currency_idx` ON `transactions` (`currency`);--> statement-breakpoint
CREATE TABLE `user_financial_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`base_currency` text(3) DEFAULT 'THB' NOT NULL,
	`locale` text(16) DEFAULT 'th-TH' NOT NULL,
	`timezone` text(64) DEFAULT 'Asia/Bangkok' NOT NULL,
	`fiscal_year_start_month` integer DEFAULT 1 NOT NULL,
	`default_return_assumption` text DEFAULT '6' NOT NULL,
	`default_inflation_assumption` text DEFAULT '2.2' NOT NULL,
	`emergency_fund_months` integer DEFAULT 6 NOT NULL,
	`display_decimals` integer DEFAULT 0 NOT NULL,
	`birth_year` integer,
	`retirement_age` integer,
	`onboarded_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "user_settings_currency_chk" CHECK("base_currency" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "user_settings_fiscal_month_chk" CHECK(fiscal_year_start_month BETWEEN 1 AND 12),
	CONSTRAINT "user_settings_emergency_chk" CHECK(emergency_fund_months BETWEEN 1 AND 36),
	CONSTRAINT "user_settings_display_decimals_chk" CHECK(display_decimals IN (0, 2))
);
