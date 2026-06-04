/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(
  initialState: { currentUser?: API.CurrentUser } | undefined,
) {
  const { currentUser } = initialState ?? {};
  const roles = currentUser?.roles ?? [];
  const hasRole = (...candidates: string[]) =>
    candidates.some((role) => roles.includes(role));
  const isAdmin = currentUser?.access === 'admin' || hasRole('System Manager');

  return {
    canAdmin: Boolean(isAdmin),
    canViewFinance: Boolean(
      isAdmin || hasRole('Accounts Manager', 'Accounts User'),
    ),
    canViewInventory: Boolean(
      isAdmin || hasRole('Stock Manager', 'Stock User'),
    ),
    canViewMasterData: Boolean(
      isAdmin ||
        hasRole(
          'Item Manager',
          'Sales Manager',
          'Purchase Manager',
          'Stock Manager',
        ),
    ),
    canViewPurchase: Boolean(
      isAdmin || hasRole('Purchase Manager', 'Purchase User'),
    ),
    canViewReports: Boolean(
      isAdmin ||
        hasRole(
          'Accounts Manager',
          'Sales Manager',
          'Purchase Manager',
          'Stock Manager',
        ),
    ),
    canViewSales: Boolean(isAdmin || hasRole('Sales Manager', 'Sales User')),
  };
}
