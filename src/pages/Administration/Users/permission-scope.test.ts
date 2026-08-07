import type { UserPermission } from '@/services/myapp/users';
import {
  buildPermissionScopeRows,
  describePermissionAddition,
  describePermissionDeletion,
} from './permission-scope';

const permission = (
  overrides: Partial<UserPermission> = {},
): UserPermission => ({
  allow: 'Company',
  applicableFor: null,
  applyToAllDoctypes: true,
  forValue: 'Demo Company',
  hideDescendants: false,
  isDefault: false,
  name: 'UP-1',
  ...overrides,
});

describe('permission scope helpers', () => {
  it('shows missing permission rows as unrestricted', () => {
    const rows = buildPermissionScopeRows({
      name: 'user@example.com',
      userPermissions: [],
      workspacePreferences: {
        defaultCompany: 'Demo Company',
        defaultWarehouse: null,
      },
    });

    expect(rows.find((row) => row.allow === 'Company')?.mode).toBe(
      'unrestricted',
    );
  });

  it('warns when a default is outside the restricted values', () => {
    const rows = buildPermissionScopeRows({
      name: 'user@example.com',
      userPermissions: [permission()],
      workspacePreferences: {
        defaultCompany: 'Other Company',
        defaultWarehouse: null,
      },
    });

    expect(rows.find((row) => row.allow === 'Company')?.warning).toContain(
      'Other Company',
    );
  });

  it('explains first-add and last-delete scope transitions', () => {
    expect(describePermissionAddition([], 'Company', true)).toContain(
      '首条 Company 权限',
    );
    expect(describePermissionDeletion([permission()], permission())).toContain(
      '恢复为角色允许的全部数据',
    );
  });
});
