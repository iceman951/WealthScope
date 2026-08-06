/** Column descriptor for `DataTable`. */
export interface Column {
	key: string;
	header: string;
	align?: 'left' | 'right';
	/** Width hint, e.g. "120px". */
	width?: string;
}
