import { callGatewayMethod } from '../api-client';
import {
  getCurrentUserProfile,
  getUserManagementOverview,
  getUserPermissionSnapshot,
  getUserSecurity,
  listRoles,
  listUsers,
  mapUserProfile,
} from '../users';

jest.mock('../api-client', () => ({
  callGatewayMethod: jest.fn(),
  createIdempotencyKey: jest.fn(() => 'test-key'),
}));

const mockedCallGatewayMethod = callGatewayMethod as jest.Mock;

describe('users service', () => {
  beforeEach(() => mockedCallGatewayMethod.mockReset());

  it('maps profile, roles and data permissions to camelCase', () => {
    expect(
      mapUserProfile({
        name: 'user@example.com',
        full_name: 'Demo User',
        enabled: 1,
        roles: ['Sales User'],
        workspace_preferences: { default_company: 'Demo' },
        user_permissions: [
          {
            name: 'UP-1',
            allow: 'Company',
            for_value: 'Demo',
            apply_to_all_doctypes: 1,
          },
        ],
      }),
    ).toMatchObject({
      enabled: true,
      fullName: 'Demo User',
      roles: ['Sales User'],
      userPermissions: [
        { allow: 'Company', applyToAllDoctypes: true, forValue: 'Demo' },
      ],
      workspacePreferences: { defaultCompany: 'Demo' },
    });
  });

  it('loads current profile through the user gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: { name: 'user@example.com', full_name: 'Demo User' },
    });

    await expect(getCurrentUserProfile()).resolves.toMatchObject({
      name: 'user@example.com',
    });
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'get_current_user_profile_v1',
    );
  });

  it('maps user pagination and role summaries', async () => {
    mockedCallGatewayMethod
      .mockResolvedValueOnce({
        data: {
          pagination: { total_count: 1 },
          users: [{ name: 'user@example.com' }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          roles: [
            {
              name: 'Sales User',
              desk_access: 1,
              doctype_count: 8,
              permission_count: 12,
              user_count: 3,
              write_doctype_count: 5,
            },
          ],
        },
      });

    await expect(listUsers({ current: 1, pageSize: 20 })).resolves.toMatchObject(
      { total: 1, users: [{ name: 'user@example.com' }] },
    );
    await expect(listRoles()).resolves.toEqual([
      expect.objectContaining({
        deskAccess: true,
        doctypeCount: 8,
        name: 'Sales User',
        permissionCount: 12,
        userCount: 3,
        writeDoctypeCount: 5,
      }),
    ]);
  });

  it('maps user governance overview metrics', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        disabled_users: 2,
        enabled_users: 8,
        never_logged_in: 3,
        system_managers: 1,
        system_users: 7,
        total_users: 10,
        users_without_roles: 1,
        website_users: 3,
      },
    });

    await expect(getUserManagementOverview()).resolves.toEqual({
      disabledUsers: 2,
      enabledUsers: 8,
      neverLoggedIn: 3,
      systemManagers: 1,
      systemUsers: 7,
      totalUsers: 10,
      usersWithoutRoles: 1,
      websiteUsers: 3,
    });
  });

  it('maps security sessions and permission snapshots', async () => {
    mockedCallGatewayMethod
      .mockResolvedValueOnce({
        data: {
          auth_generation: 2,
          frappe_session_count: 1,
          frappe_sessions: [
            {
              id: 'session-1',
              ip_address: '127.0.0.1',
              is_current: 1,
              user_agent: 'Browser',
            },
          ],
          jwt_refresh_session_count: 2,
          two_factor_enabled: 1,
          two_factor_method: 'OTP App',
          user: 'user@example.com',
        },
      })
      .mockResolvedValueOnce({
        data: {
          permissions: [
            { doctype: 'Sales Order', read: 1, write: 1, create: 0 },
          ],
          roles: ['Sales User'],
          user: 'user@example.com',
        },
      });

    await expect(getUserSecurity('user@example.com')).resolves.toMatchObject({
      authGeneration: 2,
      frappeSessions: [
        { id: 'session-1', ipAddress: '127.0.0.1', isCurrent: true },
      ],
      jwtRefreshSessionCount: 2,
      twoFactorEnabled: true,
    });
    await expect(
      getUserPermissionSnapshot('user@example.com'),
    ).resolves.toMatchObject({
      permissions: [
        { create: false, doctype: 'Sales Order', read: true, write: true },
      ],
      roles: ['Sales User'],
    });
  });
});
