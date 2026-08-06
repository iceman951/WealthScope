<script lang="ts">
	import { page } from '$app/state';
	import { NAV_SECTIONS } from './navigation';

	/**
	 * The primary navigation.
	 *
	 * One component serves both the fixed desktop rail and the off-canvas mobile
	 * drawer — the difference is CSS, so there is no second markup tree to keep in
	 * step and no duplicated link list.
	 */
	interface Props {
		open: boolean;
		onnavigate: () => void;
		recordCount: number;
		lastUpdated: string;
	}

	let { open, onnavigate, recordCount, lastUpdated }: Props = $props();

	function isCurrent(href: string): boolean {
		const path = page.url.pathname;
		return path === href || path.startsWith(`${href}/`);
	}
</script>

<aside class="sidebar" class:open id="primary-navigation">
	<div class="brand">
		<a href="/dashboard" class="brand-link">
			<span class="brand-name">WealthScope</span>
			<span class="brand-sub">Personal wealth analysis</span>
		</a>
	</div>

	<nav class="nav" aria-label="Sections">
		{#each NAV_SECTIONS as section (section.label)}
			<h2 class="group">{section.label}</h2>
			<ul>
				{#each section.items as item (item.href)}
					<li>
						<a
							href={item.href}
							class="item"
							class:current={isCurrent(item.href)}
							aria-current={isCurrent(item.href) ? 'page' : undefined}
							onclick={onnavigate}
						>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		{/each}
	</nav>

	<div class="footer">
		<div><span>Records</span><span class="num">{recordCount}</span></div>
		<div><span>Last updated</span><span>{lastUpdated}</span></div>
	</div>
</aside>

<style>
	.sidebar {
		border-right: 2px solid var(--color-divider);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--color-bg);
		grid-area: sidebar;
	}

	.brand {
		padding: var(--space-4);
		border-bottom: 2px solid var(--color-divider);
	}
	.brand-link {
		display: block;
		text-decoration: none;
		color: inherit;
	}
	.brand-name {
		display: block;
		font-family: var(--font-heading);
		font-weight: 800;
		font-size: 19px;
		letter-spacing: -0.02em;
	}
	.brand-sub {
		display: block;
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-text) 50%, transparent);
		margin-top: 2px;
	}

	.nav {
		flex: 1;
		overflow-y: auto;
		padding-bottom: var(--space-4);
	}
	.group {
		font-size: 10px;
		font-weight: 400;
		font-family: var(--font-body);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-text) 45%, transparent);
		padding: var(--space-4) var(--space-4) var(--space-2);
		margin: 0;
		line-height: 1.2;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.item {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 8px;
		text-align: left;
		font: 600 14px var(--font-body);
		background: transparent;
		border-left: 3px solid transparent;
		padding: 9px var(--space-4);
		cursor: pointer;
		color: inherit;
		text-decoration: none;
	}
	.item:hover {
		background: color-mix(in srgb, var(--color-text) 6%, transparent);
	}
	.item.current {
		border-left-color: var(--color-accent);
	}

	.footer {
		border-top: 2px solid var(--color-divider);
		padding: var(--space-3) var(--space-4);
		font-size: 11px;
		color: color-mix(in srgb, var(--color-text) 55%, transparent);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.footer div {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
	}

	@media (max-width: 900px) {
		.sidebar {
			position: fixed;
			top: 0;
			bottom: 0;
			left: 0;
			width: 236px;
			z-index: 60;
			transform: translateX(-110%);
			transition: transform 0.18s ease;
			box-shadow: none;
		}
		.sidebar.open {
			transform: translateX(0);
			box-shadow: var(--shadow-lg);
		}
	}
</style>
