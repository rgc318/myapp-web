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
});
