<script lang="ts">
	import LegalPage from '$components/layout/LegalPage.svelte';
</script>

<LegalPage title="Terms" updated="6 August 2026">
	<h2>What WealthScope is</h2>
	<p>
		WealthScope is a record-keeping and analysis tool. It computes figures from the records you
		enter: net worth, allocation, liquidity, debt metrics, portfolio returns, risk measures and
		projections.
	</p>

	<h2>What it is not</h2>
	<p>
		It is not financial, investment, tax or legal advice, and nothing it displays is a
		recommendation. Projections are arithmetic applied to assumptions you choose. They are not
		forecasts and they are not a guarantee of any outcome; actual returns will differ, and can be
		negative.
	</p>

	<h2>Accuracy</h2>
	<p>
		Figures are only as good as the records behind them. Where the data does not support a metric —
		too little price history, a missing exchange rate, no cost basis — the application says so
		rather than estimating. Check that a total is complete before relying on it.
	</p>

	<h2>Your account</h2>
	<ul>
		<li>
			Keep your password to yourself; anyone holding it can read every record in your account.
		</li>
		<li>You are responsible for the accuracy of what you enter or import.</li>
		<li>Export regularly if you want a copy of your data outside the service.</li>
	</ul>

	<h2>Availability</h2>
	<p>
		The service is provided as-is. No uptime is warranted, and the operator of a deployment may
		change or discontinue it.
	</p>
</LegalPage>
