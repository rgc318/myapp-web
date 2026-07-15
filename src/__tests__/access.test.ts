import access from '../access';

describe('access', () => {
  it('grants all business areas to system manager', () => {
    const result = access({
      currentUser: {
        access: 'admin',
        name: 'Admin',
        roles: ['System Manager'],
      },
    });

    expect(result.canAdmin).toBe(true);
    expect(result.canViewFinance).toBe(true);
    expect(result.canViewInventory).toBe(true);
    expect(result.canViewMasterData).toBe(true);
    expect(result.canViewPurchase).toBe(true);
    expect(result.canViewPrinting).toBe(true);
    expect(result.canViewAiGovernance).toBe(true);
    expect(result.canManageAiGovernance).toBe(true);
    expect(result.canApproveAiGovernance).toBe(true);
    expect(result.canPublishAiGovernance).toBe(true);
    expect(result.canViewAiDataGovernance).toBe(true);
    expect(result.canManageAiDataGovernance).toBe(true);
    expect(result.canApproveAiDataGovernance).toBe(true);
    expect(result.canRollbackAiDataGovernance).toBe(true);
    expect(result.canViewReports).toBe(true);
    expect(result.canViewSales).toBe(true);
    expect(result.canViewPrinting).toBe(true);
  });

  it('grants domain-specific permissions by role', () => {
    const result = access({
      currentUser: {
        name: 'Sales User',
        roles: ['Sales User'],
      },
    });

    expect(result.canAdmin).toBe(false);
    expect(result.canViewSales).toBe(true);
    expect(result.canViewPurchase).toBe(false);
    expect(result.canViewFinance).toBe(false);
  });

  it('allows AI governance roles without granting user administration', () => {
    const result = access({
      currentUser: {
        name: 'AI Auditor',
        roles: ['AI Auditor'],
      },
    });

    expect(result.canAdmin).toBe(false);
    expect(result.canViewAdministration).toBe(true);
    expect(result.canViewAiGovernance).toBe(true);
    expect(result.canManageAiGovernance).toBe(false);
    expect(result.canApproveAiGovernance).toBe(false);
    expect(result.canPublishAiGovernance).toBe(false);
    expect(result.canViewAiDataGovernance).toBe(true);
    expect(result.canManageAiDataGovernance).toBe(false);
    expect(result.canApproveAiDataGovernance).toBe(false);
    expect(result.canRollbackAiDataGovernance).toBe(false);
  });

  it('separates AI data stewardship from approval and rollback', () => {
    const steward = access({
      currentUser: {
        name: 'Data Steward',
        roles: ['AI Data Steward'],
      },
    });
    const approver = access({
      currentUser: {
        name: 'Data Approver',
        roles: ['AI Data Approver'],
      },
    });

    expect(steward.canViewAdministration).toBe(true);
    expect(steward.canViewAiDataGovernance).toBe(true);
    expect(steward.canManageAiDataGovernance).toBe(true);
    expect(steward.canApproveAiDataGovernance).toBe(false);
    expect(steward.canRollbackAiDataGovernance).toBe(false);
    expect(steward.canViewAiGovernance).toBe(false);

    expect(approver.canViewAiDataGovernance).toBe(true);
    expect(approver.canManageAiDataGovernance).toBe(false);
    expect(approver.canApproveAiDataGovernance).toBe(true);
    expect(approver.canRollbackAiDataGovernance).toBe(false);
    expect(approver.canViewAiGovernance).toBe(false);
  });
});
