import type { UserPermission, UserProfile } from '@/services/myapp/users';

export const managedPermissionTypes = [
  'Company',
  'Warehouse',
  'Customer',
  'Supplier',
] as const;

export type ManagedPermissionType = (typeof managedPermissionTypes)[number];

export const permissionApplicableDoctypes: Record<
  ManagedPermissionType,
  string[]
> = {
  Company: [
    'Sales Order',
    'Delivery Note',
    'Sales Invoice',
    'Purchase Order',
    'Purchase Receipt',
    'Purchase Invoice',
    'Payment Entry',
    'Warehouse',
    'Stock Entry',
  ],
  Warehouse: [
    'Sales Order',
    'Delivery Note',
    'Sales Invoice',
    'Purchase Order',
    'Purchase Receipt',
    'Purchase Invoice',
    'Stock Entry',
    'Bin',
    'Stock Ledger Entry',
  ],
  Customer: ['Sales Order', 'Delivery Note', 'Sales Invoice', 'Payment Entry'],
  Supplier: [
    'Purchase Order',
    'Purchase Receipt',
    'Purchase Invoice',
    'Payment Entry',
  ],
};

export type PermissionScopeRow = {
  allow: ManagedPermissionType;
  defaultValue: string | null;
  mode: 'bypass' | 'mixed' | 'restricted' | 'targeted' | 'unrestricted';
  permissions: UserPermission[];
  values: string[];
  warning: string | null;
};

function defaultValueFor(
  allow: ManagedPermissionType,
  workspace: UserProfile['workspacePreferences'],
) {
  if (allow === 'Company') return workspace.defaultCompany;
  if (allow === 'Warehouse') return workspace.defaultWarehouse;
  return null;
}

export function buildPermissionScopeRows(
  profile: Pick<
    UserProfile,
    'name' | 'userPermissions' | 'workspacePreferences'
  >,
): PermissionScopeRow[] {
  return managedPermissionTypes.map((allow) => {
    const permissions = profile.userPermissions.filter(
      (permission) => permission.allow === allow,
    );
    const defaultValue = defaultValueFor(allow, profile.workspacePreferences);
    const values = [...new Set(permissions.map((row) => row.forValue))].sort();
    const hasGlobal = permissions.some((row) => row.applyToAllDoctypes);
    const hasTargeted = permissions.some((row) => !row.applyToAllDoctypes);
    let mode: PermissionScopeRow['mode'] = 'unrestricted';
    if (profile.name === 'Administrator') mode = 'bypass';
    else if (hasGlobal && hasTargeted) mode = 'mixed';
    else if (hasGlobal) mode = 'restricted';
    else if (hasTargeted) mode = 'targeted';

    let warning: string | null = null;
    if (
      defaultValue &&
      permissions.length > 0 &&
      !permissions.some((row) => row.forValue === defaultValue)
    ) {
      warning = `默认值 ${defaultValue} 不在当前 ${allow} 授权范围内`;
    }

    return {
      allow,
      defaultValue,
      mode,
      permissions,
      values,
      warning,
    };
  });
}

export function describePermissionAddition(
  permissions: UserPermission[],
  allow: ManagedPermissionType,
  applyToAllDoctypes: boolean,
  applicableFor?: string,
) {
  const sameTypeCount = permissions.filter(
    (permission) => permission.allow === allow,
  ).length;
  if (!applyToAllDoctypes) {
    return `只收窄 ${applicableFor || '所选单据类型'}；其他单据是否受限取决于已有规则。`;
  }
  if (sameTypeCount === 0) {
    return `这是首条 ${allow} 权限。保存后会从“未按该维度限制”切换为“仅允许已授权值”。`;
  }
  return `将扩展现有 ${allow} 授权范围；同类型多条权限按允许值并集生效。`;
}

export function describePermissionDeletion(
  permissions: UserPermission[],
  permission: UserPermission,
) {
  const sameType = permissions.filter((row) => row.allow === permission.allow);
  if (sameType.length === 1) {
    return `这是最后一条 ${permission.allow} 权限。删除后将不再按该维度收窄，可能恢复为角色允许的全部数据。`;
  }
  return `删除后会移除 ${permission.forValue}，其余 ${permission.allow} 授权继续生效。`;
}
