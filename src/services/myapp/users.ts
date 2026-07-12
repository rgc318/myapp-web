import { callGatewayMethod } from './api-client';
import { compactPayload, readObject, toOptionalText } from './api-utils';
import { runGatewayMutation } from './mutation';

export type UserPermission = {
  allow: string;
  applicableFor: string | null;
  applyToAllDoctypes: boolean;
  forValue: string;
  hideDescendants: boolean;
  isDefault: boolean;
  name: string;
};

export type UserAuditEntry = {
  changedBy: string;
  changes: Array<{ field: string; newValue: unknown; oldValue: unknown }>;
  creation: string | null;
  name: string;
};

export type UserProfile = {
  bio: string | null;
  birthDate: string | null;
  capabilities: Record<string, boolean>;
  creation: string | null;
  email: string;
  enabled: boolean;
  firstName: string;
  fullName: string;
  gender: string | null;
  interest: string | null;
  language: string | null;
  lastActive: string | null;
  lastIp: string | null;
  lastLogin: string | null;
  lastName: string | null;
  lastPasswordResetDate: string | null;
  location: string | null;
  middleName: string | null;
  mobileNo: string | null;
  modified: string | null;
  name: string;
  phone: string | null;
  roles: string[];
  shortBio: string | null;
  timeZone: string | null;
  userImage: string | null;
  userPermissions: UserPermission[];
  userType: string;
  username: string | null;
  workspacePreferences: {
    defaultCompany: string | null;
    defaultWarehouse: string | null;
  };
  auditLog: UserAuditEntry[];
};

export type RoleSummary = {
  automatic: boolean;
  deskAccess: boolean;
  disabled: boolean;
  doctypeCount: number;
  name: string;
  permissionCount: number;
  restrictToDomain: string | null;
  userCount: number;
  writeDoctypeCount: number;
};

export type UserManagementOverview = {
  disabledUsers: number;
  enabledUsers: number;
  neverLoggedIn: number;
  systemManagers: number;
  systemUsers: number;
  totalUsers: number;
  usersWithoutRoles: number;
  websiteUsers: number;
};

export type UserSecuritySession = {
  id: string;
  ipAddress: string | null;
  isCurrent: boolean;
  lastUpdated: string | null;
  sessionCreated: string | null;
  userAgent: string | null;
};

export type UserSecurity = {
  authGeneration: number;
  frappeSessionCount: number;
  frappeSessions: UserSecuritySession[];
  jwtRefreshSessionCount: number;
  lastActive: string | null;
  lastIp: string | null;
  lastLogin: string | null;
  lastPasswordResetDate: string | null;
  restrictIp: string | null;
  simultaneousSessions: number;
  twoFactorEnabled: boolean;
  twoFactorMethod: string | null;
  user: string;
};

export type UserPermissionSnapshotRow = {
  cancel: boolean;
  create: boolean;
  delete: boolean;
  doctype: string;
  export: boolean;
  ifOwner: boolean;
  read: boolean;
  report: boolean;
  submit: boolean;
  write: boolean;
};

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null;

function mapPermission(value: unknown): UserPermission {
  const row = readObject(value);
  return {
    allow: String(row.allow ?? ''),
    applicableFor: text(row.applicable_for),
    applyToAllDoctypes: Boolean(row.apply_to_all_doctypes),
    forValue: String(row.for_value ?? ''),
    hideDescendants: Boolean(row.hide_descendants),
    isDefault: Boolean(row.is_default),
    name: String(row.name ?? ''),
  };
}

function mapAuditEntry(value: unknown): UserAuditEntry {
  const row = readObject(value);
  return {
    changedBy: String(row.changed_by ?? ''),
    changes: Array.isArray(row.changes)
      ? row.changes.map((change) => {
          const item = readObject(change);
          return {
            field: String(item.field ?? ''),
            newValue: item.new,
            oldValue: item.old,
          };
        })
      : [],
    creation: text(row.creation),
    name: String(row.name ?? ''),
  };
}

export function mapUserProfile(value: unknown): UserProfile {
  const row = readObject(value);
  const workspace = readObject(row.workspace_preferences);
  return {
    auditLog: Array.isArray(row.audit_log)
      ? row.audit_log.map(mapAuditEntry)
      : [],
    bio: text(row.bio),
    birthDate: text(row.birth_date),
    capabilities: Object.fromEntries(
      Object.entries(readObject(row.capabilities)).map(([key, flag]) => [
        key,
        Boolean(flag),
      ]),
    ),
    creation: text(row.creation),
    email: String(row.email ?? row.name ?? ''),
    enabled: Boolean(row.enabled),
    firstName: String(row.first_name ?? ''),
    fullName: String(row.full_name ?? row.name ?? ''),
    gender: text(row.gender),
    interest: text(row.interest),
    language: text(row.language),
    lastActive: text(row.last_active),
    lastIp: text(row.last_ip),
    lastLogin: text(row.last_login),
    lastName: text(row.last_name),
    lastPasswordResetDate: text(row.last_password_reset_date),
    location: text(row.location),
    middleName: text(row.middle_name),
    mobileNo: text(row.mobile_no),
    modified: text(row.modified),
    name: String(row.name ?? row.email ?? ''),
    phone: text(row.phone),
    roles: Array.isArray(row.roles)
      ? row.roles.filter((role): role is string => typeof role === 'string')
      : [],
    shortBio: text(row.short_bio),
    timeZone: text(row.time_zone),
    userImage: text(row.user_image),
    userPermissions: Array.isArray(row.user_permissions)
      ? row.user_permissions.map(mapPermission)
      : [],
    userType: String(row.user_type ?? ''),
    username: text(row.username),
    workspacePreferences: {
      defaultCompany: text(workspace.default_company),
      defaultWarehouse: text(workspace.default_warehouse),
    },
  };
}

export async function getCurrentUserProfile() {
  const result = await callGatewayMethod<unknown>(
    'get_current_user_profile_v1',
  );
  return mapUserProfile(result.data);
}

export async function uploadCurrentUserAvatar(payload: {
  contentType?: string;
  fileContentBase64: string;
  filename: string;
}) {
  return runGatewayMutation<{ fileId: string; fileName: string; fileUrl: string }>(
    'upload_current_user_avatar_v1',
    {
      payload: compactPayload({
        content_type: payload.contentType,
        file_content_base64: payload.fileContentBase64,
        filename: payload.filename,
      }),
      successMessage: '头像已更新',
      transform: (value) => {
        const row = readObject(value);
        return {
          fileId: String(row.file_id ?? ''),
          fileName: String(row.file_name ?? ''),
          fileUrl: String(row.file_url ?? ''),
        };
      },
    },
  );
}

function mapUserSecurity(value: unknown): UserSecurity {
  const row = readObject(value);
  return {
    authGeneration: Number(row.auth_generation ?? 0),
    frappeSessionCount: Number(row.frappe_session_count ?? 0),
    frappeSessions: Array.isArray(row.frappe_sessions)
      ? row.frappe_sessions.map((value) => {
          const session = readObject(value);
          return {
            id: String(session.id ?? ''),
            ipAddress: text(session.ip_address),
            isCurrent: Boolean(session.is_current),
            lastUpdated: text(session.last_updated),
            sessionCreated: text(session.session_created),
            userAgent: text(session.user_agent),
          };
        })
      : [],
    jwtRefreshSessionCount: Number(row.jwt_refresh_session_count ?? 0),
    lastActive: text(row.last_active),
    lastIp: text(row.last_ip),
    lastLogin: text(row.last_login),
    lastPasswordResetDate: text(row.last_password_reset_date),
    restrictIp: text(row.restrict_ip),
    simultaneousSessions: Number(row.simultaneous_sessions ?? 1),
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    twoFactorMethod: text(row.two_factor_method),
    user: String(row.user ?? ''),
  };
}

export async function getUserSecurity(user?: string) {
  const result = await callGatewayMethod<unknown>(
    'get_user_security_v1',
    compactPayload({ user: toOptionalText(user) }),
  );
  return mapUserSecurity(result.data);
}

export async function revokeUserSessions(user?: string) {
  return runGatewayMutation<{
    authGeneration: number;
    reauthenticationRequired: boolean;
    user: string;
  }>('revoke_user_sessions_v1', {
    payload: compactPayload({ user: toOptionalText(user) }),
    successMessage: '账号会话已全部注销',
    transform: (value) => {
      const row = readObject(value);
      return {
        authGeneration: Number(row.auth_generation ?? 0),
        reauthenticationRequired: Boolean(row.reauthentication_required),
        user: String(row.user ?? ''),
      };
    },
  });
}

export async function getUserPermissionSnapshot(user: string) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'get_user_permission_snapshot_v1',
    { user },
  );
  const data = readObject(result.data);
  return {
    permissions: Array.isArray(data.permissions)
      ? data.permissions.map((value): UserPermissionSnapshotRow => {
          const row = readObject(value);
          return {
            cancel: Boolean(row.cancel),
            create: Boolean(row.create),
            delete: Boolean(row.delete),
            doctype: String(row.doctype ?? ''),
            export: Boolean(row.export),
            ifOwner: Boolean(row.if_owner),
            read: Boolean(row.read),
            report: Boolean(row.report),
            submit: Boolean(row.submit),
            write: Boolean(row.write),
          };
        })
      : [],
    roles: Array.isArray(data.roles)
      ? data.roles.filter((role): role is string => typeof role === 'string')
      : [],
    user: String(data.user ?? user),
  };
}

export async function updateCurrentUserProfile(
  payload: Partial<
    Pick<
      UserProfile,
      | 'bio'
      | 'birthDate'
      | 'firstName'
      | 'gender'
      | 'interest'
      | 'language'
      | 'lastName'
      | 'location'
      | 'middleName'
      | 'mobileNo'
      | 'phone'
      | 'shortBio'
      | 'timeZone'
      | 'userImage'
    >
  >,
) {
  return runGatewayMutation<UserProfile>('update_current_user_profile_v1', {
    payload: compactPayload({
      bio: toOptionalText(payload.bio),
      birth_date: toOptionalText(payload.birthDate),
      first_name: toOptionalText(payload.firstName),
      gender: toOptionalText(payload.gender),
      interest: toOptionalText(payload.interest),
      language: toOptionalText(payload.language),
      last_name: toOptionalText(payload.lastName),
      location: toOptionalText(payload.location),
      middle_name: toOptionalText(payload.middleName),
      mobile_no: toOptionalText(payload.mobileNo),
      phone: toOptionalText(payload.phone),
      short_bio: toOptionalText(payload.shortBio),
      time_zone: toOptionalText(payload.timeZone),
      user_image: toOptionalText(payload.userImage),
    }),
    successMessage: '个人资料已保存',
    transform: mapUserProfile,
  });
}

export async function changeCurrentUserPassword(payload: {
  logoutAllSessions?: boolean;
  newPassword: string;
  oldPassword: string;
}) {
  return runGatewayMutation<{ reauthenticationRequired: boolean }>(
    'change_current_user_password_v1',
    {
      payload: {
        logout_all_sessions: payload.logoutAllSessions === false ? 0 : 1,
        new_password: payload.newPassword,
        old_password: payload.oldPassword,
      },
      successMessage: '密码已更新',
      transform: (value) => ({
        reauthenticationRequired: Boolean(
          readObject(value).reauthentication_required,
        ),
      }),
    },
  );
}

export async function listUsers(params: {
  current?: number;
  enabled?: boolean;
  pageSize?: number;
  role?: string;
  search?: string;
  userType?: string;
}) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_users_v1',
    compactPayload({
      enabled:
        typeof params.enabled === 'boolean' ? (params.enabled ? 1 : 0) : null,
      page: params.current ?? 1,
      page_size: params.pageSize ?? 20,
      role: toOptionalText(params.role),
      search: toOptionalText(params.search),
      user_type: toOptionalText(params.userType),
    }),
  );
  const data = readObject(result.data);
  const pagination = readObject(data.pagination);
  return {
    total: Number(pagination.total_count ?? 0),
    users: Array.isArray(data.users) ? data.users.map(mapUserProfile) : [],
  };
}

export async function getUserDetail(user: string) {
  const result = await callGatewayMethod<unknown>('get_user_detail_v1', {
    user,
  });
  return mapUserProfile(result.data);
}

export async function listRoles(search?: string) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_roles_v1',
    compactPayload({ search: toOptionalText(search) }),
  );
  const data = readObject(result.data);
  return Array.isArray(data.roles)
    ? data.roles.map((value): RoleSummary => {
        const row = readObject(value);
        return {
          automatic: Boolean(row.automatic),
          deskAccess: Boolean(row.desk_access),
          disabled: Boolean(row.disabled),
          doctypeCount: Number(row.doctype_count ?? 0),
          name: String(row.name ?? ''),
          permissionCount: Number(row.permission_count ?? 0),
          restrictToDomain: text(row.restrict_to_domain),
          userCount: Number(row.user_count ?? 0),
          writeDoctypeCount: Number(row.write_doctype_count ?? 0),
        };
      })
    : [];
}

export async function getUserManagementOverview() {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'get_user_management_overview_v1',
  );
  const row = readObject(result.data);
  return {
    disabledUsers: Number(row.disabled_users ?? 0),
    enabledUsers: Number(row.enabled_users ?? 0),
    neverLoggedIn: Number(row.never_logged_in ?? 0),
    systemManagers: Number(row.system_managers ?? 0),
    systemUsers: Number(row.system_users ?? 0),
    totalUsers: Number(row.total_users ?? 0),
    usersWithoutRoles: Number(row.users_without_roles ?? 0),
    websiteUsers: Number(row.website_users ?? 0),
  } satisfies UserManagementOverview;
}

export async function createUser(payload: {
  email: string;
  enabled?: boolean;
  firstName: string;
  lastName?: string;
  mobileNo?: string;
  password?: string;
  roles?: string[];
  sendWelcomeEmail?: boolean;
}) {
  return runGatewayMutation<UserProfile>('create_user_v1', {
    payload: compactPayload({
      email: payload.email,
      enabled: payload.enabled === false ? 0 : 1,
      first_name: payload.firstName,
      last_name: toOptionalText(payload.lastName),
      mobile_no: toOptionalText(payload.mobileNo),
      password: toOptionalText(payload.password),
      roles: payload.roles ?? [],
      send_welcome_email: payload.sendWelcomeEmail ? 1 : 0,
    }),
    successMessage: '用户已创建',
    transform: mapUserProfile,
  });
}

export async function updateUser(
  user: string,
  payload: Partial<UserProfile>,
) {
  return runGatewayMutation<UserProfile>('update_user_v1', {
    payload: compactPayload({
      bio: toOptionalText(payload.bio),
      first_name: toOptionalText(payload.firstName),
      language: toOptionalText(payload.language),
      last_name: toOptionalText(payload.lastName),
      location: toOptionalText(payload.location),
      mobile_no: toOptionalText(payload.mobileNo),
      phone: toOptionalText(payload.phone),
      time_zone: toOptionalText(payload.timeZone),
      user,
      user_image: toOptionalText(payload.userImage),
      username: toOptionalText(payload.username),
    }),
    successMessage: '用户资料已保存',
    transform: mapUserProfile,
  });
}

export async function setUserEnabled(user: string, enabled: boolean) {
  return runGatewayMutation<UserProfile>('set_user_enabled_v1', {
    payload: { enabled: enabled ? 1 : 0, user },
    successMessage: enabled ? '用户已启用' : '用户已停用',
    transform: mapUserProfile,
  });
}

export async function batchSetUsersEnabled(users: string[], enabled: boolean) {
  return runGatewayMutation<{
    enabled: boolean;
    updatedCount: number;
    users: string[];
  }>('batch_set_users_enabled_v1', {
    payload: { enabled: enabled ? 1 : 0, users },
    successMessage: `已${enabled ? '启用' : '停用'} ${users.length} 个用户`,
    transform: (value) => {
      const row = readObject(value);
      return {
        enabled: Boolean(row.enabled),
        updatedCount: Number(row.updated_count ?? 0),
        users: Array.isArray(row.users)
          ? row.users.filter(
              (user): user is string => typeof user === 'string',
            )
          : [],
      };
    },
  });
}

export async function updateUserRoles(user: string, roles: string[]) {
  return runGatewayMutation<UserProfile>('update_user_roles_v1', {
    payload: { roles, user },
    successMessage: '用户角色已保存',
    transform: mapUserProfile,
  });
}

export async function addUserPermission(payload: {
  allow: string;
  applicableFor?: string;
  applyToAllDoctypes?: boolean;
  forValue: string;
  isDefault?: boolean;
  user: string;
}) {
  return runGatewayMutation<UserPermission>('add_user_permission_v1', {
    payload: compactPayload({
      allow: payload.allow,
      applicable_for: toOptionalText(payload.applicableFor),
      apply_to_all_doctypes:
        payload.applyToAllDoctypes === false ? 0 : 1,
      for_value: payload.forValue,
      is_default: payload.isDefault ? 1 : 0,
      user: payload.user,
    }),
    successMessage: '数据权限已添加',
    transform: mapPermission,
  });
}

export async function deleteUserPermission(
  user: string,
  permissionName: string,
) {
  return runGatewayMutation<{ name: string }>(
    'delete_user_permission_v1',
    {
      payload: { permission_name: permissionName, user },
      successMessage: '数据权限已删除',
      transform: (value) => ({ name: String(readObject(value).name ?? '') }),
    },
  );
}
