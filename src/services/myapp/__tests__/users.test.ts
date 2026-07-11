import { callGatewayMethod } from '../api-client';
import { getCurrentUserProfile, listRoles, listUsers, mapUserProfile } from '../users';

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
          roles: [{ name: 'Sales User', desk_access: 1, user_count: 3 }],
        },
      });

    await expect(listUsers({ current: 1, pageSize: 20 })).resolves.toMatchObject(
      { total: 1, users: [{ name: 'user@example.com' }] },
    );
    await expect(listRoles()).resolves.toEqual([
      expect.objectContaining({
        deskAccess: true,
        name: 'Sales User',
        userCount: 3,
      }),
    ]);
  });
});
