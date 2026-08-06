<script lang="ts">
	import LegalPage from '$components/layout/LegalPage.svelte';
</script>

<LegalPage title="Privacy" updated="6 August 2026">
	<h2>What this states</h2>
	<p>
		WealthScope is a server-backed application. The records you enter — accounts, assets,
		investments, transactions, liabilities, income, expenses, goals and settings — are stored in a
		PostgreSQL database operated by the deployment you signed up to. They are not held only in your
		browser.
	</p>

	<h2>What is stored</h2>
	<ul>
		<li>Your name, email address and a hash of your password.</li>
		<li>Session records, so you stay signed in, with the time and originating address.</li>
		<li>Every financial record you create or import, scoped to your account.</li>
		<li>Import metadata: the file name, its size and a hash of its contents.</li>
	</ul>
	<p>
		Uploaded CSV files are parsed in memory and discarded. Their contents are never written to
		object storage and never appear in a log line.
	</p>

	<h2>Who can read it</h2>
	<p>
		Every query is scoped to the authenticated account. No other user can read, list or reference
		your records, and the application has no cross-account view.
	</p>

	<h2>What leaves the system</h2>
	<p>
		No financial data is sent to a third party. The application makes no market-data, analytics or
		advertising requests. The only external resource a page loads is the Archivo typeface from
		Google Fonts.
	</p>

	<h2>Deleting your data</h2>
	<p>
		Deleting a record removes it immediately. Deleting your account removes every record that
		belongs to it, by database cascade, with no soft-delete copy retained. Export first if you want
		a copy — the CSV export mirrors the import schema, so a round trip is lossless.
	</p>

	<h2>Contact</h2>
	<p>
		This is the privacy statement of the WealthScope software. The operator of the deployment you
		signed up to is the data controller and is the party to contact about a specific request.
	</p>
</LegalPage>
