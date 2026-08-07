CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"price" numeric(24, 8) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"price_date" date NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_prices_source_chk" CHECK ("source" IN ('manual', 'import', 'provider')),
	CONSTRAINT "asset_prices_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "asset_prices_price_chk" CHECK ("price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid,
	"name" varchar(160) NOT NULL,
	"asset_type" text NOT NULL,
	"symbol" varchar(32),
	"currency" varchar(3) NOT NULL,
	"quantity" numeric(30, 12) DEFAULT '1' NOT NULL,
	"unit_price" numeric(24, 8) DEFAULT '0' NOT NULL,
	"manual_value" numeric(24, 8),
	"acquisition_cost" numeric(24, 8),
	"valuation_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_type_chk" CHECK ("asset_type" IN ('cash', 'stock', 'etf', 'bond', 'fund', 'crypto', 'property', 'vehicle', 'business', 'collectible', 'other')),
	CONSTRAINT "assets_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "assets_quantity_chk" CHECK ("quantity" >= 0),
	CONSTRAINT "assets_unit_price_chk" CHECK ("unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cashflow_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entry_type" text NOT NULL,
	"category" text NOT NULL,
	"name" varchar(160) NOT NULL,
	"amount" numeric(24, 8) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"frequency" text NOT NULL,
	"entry_date" date NOT NULL,
	"end_date" date,
	"is_recurring" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cashflow_entry_type_chk" CHECK ("entry_type" IN ('income', 'expense')),
	CONSTRAINT "cashflow_category_chk" CHECK ("category" IN ('salary', 'business', 'rental', 'dividends', 'interest', 'pension', 'other_income', 'housing', 'living', 'taxes', 'education', 'transport', 'insurance', 'fees', 'debt_service', 'other_expense')),
	CONSTRAINT "cashflow_frequency_chk" CHECK ("frequency" IN ('once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual')),
	CONSTRAINT "cashflow_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "cashflow_amount_chk" CHECK ("amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" varchar(3) NOT NULL,
	"quote_currency" varchar(3) NOT NULL,
	"rate" numeric(24, 12) NOT NULL,
	"rate_date" date NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_base_chk" CHECK ("base_currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "exchange_rates_quote_chk" CHECK ("quote_currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "exchange_rates_rate_chk" CHECK (rate > 0)
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(160) NOT NULL,
	"account_type" text NOT NULL,
	"institution" varchar(160),
	"currency" varchar(3) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_accounts_type_chk" CHECK ("account_type" IN ('cash', 'bank', 'brokerage', 'retirement', 'crypto', 'property', 'loan', 'credit', 'other')),
	CONSTRAINT "financial_accounts_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "financial_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(160) NOT NULL,
	"goal_type" text NOT NULL,
	"target_amount" numeric(24, 8) NOT NULL,
	"current_amount" numeric(24, 8) DEFAULT '0' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"target_date" date,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_goals_type_chk" CHECK ("goal_type" IN ('emergency_fund', 'retirement', 'property', 'education', 'debt_payoff', 'travel', 'other')),
	CONSTRAINT "financial_goals_status_chk" CHECK ("status" IN ('active', 'achieved', 'paused', 'abandoned')),
	CONSTRAINT "financial_goals_priority_chk" CHECK ("priority" IN ('low', 'medium', 'high')),
	CONSTRAINT "financial_goals_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "financial_goals_target_chk" CHECK (target_amount > 0)
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_batches_kind_chk" CHECK ("kind" IN ('assets', 'transactions', 'liabilities', 'cashflow')),
	CONSTRAINT "import_batches_status_chk" CHECK ("status" IN ('pending', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "liabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid,
	"name" varchar(160) NOT NULL,
	"liability_type" text NOT NULL,
	"currency" varchar(3) NOT NULL,
	"original_principal" numeric(24, 8) NOT NULL,
	"outstanding_balance" numeric(24, 8) NOT NULL,
	"interest_rate" numeric(14, 8) NOT NULL,
	"minimum_payment" numeric(24, 8),
	"monthly_payment" numeric(24, 8),
	"start_date" date,
	"maturity_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "liabilities_type_chk" CHECK ("liability_type" IN ('mortgage', 'auto_loan', 'student_loan', 'personal_loan', 'credit_card', 'line_of_credit', 'business_loan', 'other')),
	CONSTRAINT "liabilities_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "liabilities_balance_chk" CHECK ("outstanding_balance" >= 0),
	CONSTRAINT "liabilities_principal_chk" CHECK ("original_principal" >= 0),
	CONSTRAINT "liabilities_rate_chk" CHECK ("interest_rate" >= 0)
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"snapshot_date" date NOT NULL,
	"base_currency" varchar(3) NOT NULL,
	"total_assets" numeric(24, 8) NOT NULL,
	"total_liabilities" numeric(24, 8) NOT NULL,
	"net_worth" numeric(24, 8) NOT NULL,
	"liquid_assets" numeric(24, 8) NOT NULL,
	"investment_assets" numeric(24, 8) NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_snapshots_currency_chk" CHECK ("base_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"asset_id" uuid,
	"transaction_type" text NOT NULL,
	"transaction_date" date NOT NULL,
	"quantity" numeric(30, 12),
	"unit_price" numeric(24, 8),
	"gross_amount" numeric(24, 8) NOT NULL,
	"fee_amount" numeric(24, 8) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(24, 8) DEFAULT '0' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"exchange_rate" numeric(24, 12),
	"notes" text,
	"import_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_type_chk" CHECK ("transaction_type" IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'interest', 'fee', 'tax', 'transfer', 'adjustment')),
	CONSTRAINT "transactions_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "transactions_fee_chk" CHECK ("fee_amount" >= 0),
	CONSTRAINT "transactions_tax_chk" CHECK ("tax_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_financial_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"base_currency" varchar(3) DEFAULT 'THB' NOT NULL,
	"locale" varchar(16) DEFAULT 'th-TH' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Bangkok' NOT NULL,
	"fiscal_year_start_month" integer DEFAULT 1 NOT NULL,
	"default_return_assumption" numeric(14, 8) DEFAULT '6' NOT NULL,
	"default_inflation_assumption" numeric(14, 8) DEFAULT '2.2' NOT NULL,
	"emergency_fund_months" integer DEFAULT 6 NOT NULL,
	"display_decimals" integer DEFAULT 0 NOT NULL,
	"birth_year" integer,
	"retirement_age" integer,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_currency_chk" CHECK ("base_currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "user_settings_fiscal_month_chk" CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
	CONSTRAINT "user_settings_emergency_chk" CHECK (emergency_fund_months BETWEEN 1 AND 36),
	CONSTRAINT "user_settings_display_decimals_chk" CHECK (display_decimals IN (0, 2))
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_prices" ADD CONSTRAINT "asset_prices_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashflow_entries" ADD CONSTRAINT "cashflow_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_financial_settings" ADD CONSTRAINT "user_financial_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_prices_unique" ON "asset_prices" USING btree ("asset_id","price_date","source");--> statement-breakpoint
CREATE INDEX "asset_prices_asset_date_idx" ON "asset_prices" USING btree ("asset_id","price_date");--> statement-breakpoint
CREATE INDEX "assets_user_idx" ON "assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assets_user_type_idx" ON "assets" USING btree ("user_id","asset_type");--> statement-breakpoint
CREATE INDEX "assets_account_idx" ON "assets" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "assets_symbol_idx" ON "assets" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "assets_currency_idx" ON "assets" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "assets_user_valuation_idx" ON "assets" USING btree ("user_id","valuation_date");--> statement-breakpoint
CREATE INDEX "cashflow_user_idx" ON "cashflow_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cashflow_user_type_idx" ON "cashflow_entries" USING btree ("user_id","entry_type");--> statement-breakpoint
CREATE INDEX "cashflow_user_date_idx" ON "cashflow_entries" USING btree ("user_id","entry_date");--> statement-breakpoint
CREATE INDEX "cashflow_currency_idx" ON "cashflow_entries" USING btree ("currency");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_unique" ON "exchange_rates" USING btree ("base_currency","quote_currency","rate_date","source");--> statement-breakpoint
CREATE INDEX "exchange_rates_pair_date_idx" ON "exchange_rates" USING btree ("base_currency","quote_currency","rate_date");--> statement-breakpoint
CREATE INDEX "financial_accounts_user_idx" ON "financial_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "financial_accounts_user_type_idx" ON "financial_accounts" USING btree ("user_id","account_type");--> statement-breakpoint
CREATE INDEX "financial_accounts_currency_idx" ON "financial_accounts" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "financial_goals_user_idx" ON "financial_goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "financial_goals_user_status_idx" ON "financial_goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "financial_goals_user_target_date_idx" ON "financial_goals" USING btree ("user_id","target_date");--> statement-breakpoint
CREATE INDEX "import_batches_user_idx" ON "import_batches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "import_batches_user_hash_idx" ON "import_batches" USING btree ("user_id","content_hash");--> statement-breakpoint
CREATE INDEX "liabilities_user_idx" ON "liabilities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "liabilities_user_type_idx" ON "liabilities" USING btree ("user_id","liability_type");--> statement-breakpoint
CREATE INDEX "liabilities_account_idx" ON "liabilities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "liabilities_currency_idx" ON "liabilities" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "liabilities_user_maturity_idx" ON "liabilities" USING btree ("user_id","maturity_date");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_snapshots_user_date_unique" ON "portfolio_snapshots" USING btree ("user_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "portfolio_snapshots_user_date_idx" ON "portfolio_snapshots" USING btree ("user_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "transactions_user_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","transaction_date");--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transactions_asset_idx" ON "transactions" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "transactions_user_type_idx" ON "transactions" USING btree ("user_id","transaction_type");--> statement-breakpoint
CREATE INDEX "transactions_currency_idx" ON "transactions" USING btree ("currency");