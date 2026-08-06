/** The navigation tree, mirroring the design's four sidebar groups. */

export interface NavItem {
	label: string;
	href: string;
	/** Title and subtitle for the screen header. */
	title: string;
	subtitle: string;
}

export interface NavSection {
	label: string;
	items: NavItem[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
	{
		label: 'Overview',
		items: [
			{
				label: 'Dashboard',
				href: '/dashboard',
				title: 'Dashboard',
				subtitle: 'Net worth, allocation and health at a glance'
			}
		]
	},
	{
		label: 'Record',
		items: [
			{
				label: 'Accounts',
				href: '/accounts',
				title: 'Accounts',
				subtitle: 'Banks, brokers, wrappers and where each record sits'
			},
			{
				label: 'Assets',
				href: '/assets',
				title: 'Assets',
				subtitle: 'Property, cash, deposits, savings and retirement'
			},
			{
				label: 'Investments',
				href: '/investments',
				title: 'Investments',
				subtitle: 'Holdings, cost basis and sleeve weights'
			},
			{
				label: 'Liabilities',
				href: '/liabilities',
				title: 'Liabilities',
				subtitle: 'Balances, rates, debt service and payoff order'
			},
			{
				label: 'Income & expenses',
				href: '/cashflow',
				title: 'Income & expenses',
				subtitle: 'Monthly cash flow, streams and categories'
			}
		]
	},
	{
		label: 'Analyze',
		items: [
			{
				label: 'Analyze my wealth',
				href: '/analyze/overview',
				title: 'Analyze my wealth',
				subtitle: 'One deterministic pass over every record'
			},
			{
				label: 'Risk analysis',
				href: '/analyze/risk',
				title: 'Risk analysis',
				subtitle: 'Volatility, concentration, correlation and stress tests'
			},
			{
				label: 'Wealth projection',
				href: '/analyze/projection',
				title: 'Wealth projection',
				subtitle: 'Compounding under your own assumptions'
			}
		]
	},
	{
		label: 'Data',
		items: [
			{
				label: 'Reports',
				href: '/reports',
				title: 'Reports',
				subtitle: 'CSV exports and PDF statements'
			},
			{
				label: 'Import CSV',
				href: '/import',
				title: 'Import CSV',
				subtitle: 'Map columns, review every row, then commit'
			},
			{
				label: 'Settings',
				href: '/settings',
				title: 'Settings',
				subtitle: 'Currency, assumptions, exchange rates and your account'
			}
		]
	}
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

/** Longest matching prefix, so /assets/new still resolves to the Assets header. */
export function screenFor(pathname: string): NavItem | null {
	const matches = ALL_ITEMS.filter(
		(item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
	);
	return matches.sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}
