import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/** Only `generate` is used; migrations are applied by the app on startup (src/lib/server/db). */
export default defineConfig({
	schema: './src/lib/server/db/schema/index.ts',
	out: './drizzle',
	dialect: 'sqlite',
	strict: true,
	verbose: true
});
