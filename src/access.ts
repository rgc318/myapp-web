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
  const canViewAiGovernance = Boolean(
    isAdmin || hasRole('AI Model Manager', 'AI Model Approver', 'AI Auditor'),
  );
  const canViewAiDataGovernance = Boolean(
    isAdmin || hasRole('AI Data Steward', 'AI Data Approver', 'AI Auditor'),
  );

  return {
    canAdmin: Boolean(isAdmin),
    canViewAdministration: Boolean(
      isAdmin || canViewAiGovernance || canViewAiDataGovernance,
    ),
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
    canViewPendingConfirmations: Boolean(
      isAdmin ||
        hasRole(
          'Accounts Manager',
          'Purchase Manager',
          'Sales Manager',
          'Stock Manager',
        ),
    ),
    canViewPrinting: Boolean(
      isAdmin ||
        hasRole(
          'Accounts Manager',
          'Accounts User',
          'Purchase Manager',
          'Purchase User',
          'Sales Manager',
          'Sales User',
          'Stock Manager',
          'Stock User',
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
    canUseAI: Boolean(currentUser),
    canViewAiGovernance,
    canManageAiGovernance: Boolean(isAdmin || hasRole('AI Model Manager')),
    canApproveAiGovernance: Boolean(isAdmin || hasRole('AI Model Approver')),
    canPublishAiGovernance: Boolean(isAdmin),
    canViewAiDataGovernance,
    canManageAiDataGovernance: Boolean(isAdmin || hasRole('AI Data Steward')),
    canApproveAiDataGovernance: Boolean(isAdmin || hasRole('AI Data Approver')),
    canRollbackAiDataGovernance: Boolean(isAdmin),
  };
}
