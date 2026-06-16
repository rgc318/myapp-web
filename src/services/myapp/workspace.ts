import { callGatewayMethod } from './api-client';
import { compactPayload, readObject, toOptionalText } from './api-utils';
import { runGatewayMutation } from './mutation';

export type WorkspacePreferences = {
  defaultCompany: string | null;
  defaultWarehouse: string | null;
  user: string;
};

function mapWorkspacePreferences(raw: unknown): WorkspacePreferences {
  const row = readObject(raw);
  return {
    defaultCompany:
      typeof row.default_company === 'string' && row.default_company.trim()
        ? row.default_company
        : null,
    defaultWarehouse:
      typeof row.default_warehouse === 'string' &&
      row.default_warehouse.trim()
        ? row.default_warehouse
        : null,
    user: String(row.user ?? ''),
  };
}

export async function getCurrentUserWorkspacePreferences() {
  const result = await callGatewayMethod<unknown>(
    'get_current_user_workspace_preferences_v1',
  );
  return mapWorkspacePreferences(result.data);
}

export async function updateCurrentUserWorkspacePreferences(payload: {
  defaultCompany?: string | null;
  defaultWarehouse?: string | null;
}) {
  return runGatewayMutation<WorkspacePreferences>(
    'update_current_user_workspace_preferences_v1',
    {
      payload: compactPayload({
        default_company: toOptionalText(payload.defaultCompany),
        default_warehouse: toOptionalText(payload.defaultWarehouse),
      }),
      successMessage: '工作偏好已保存',
      transform: mapWorkspacePreferences,
    },
  );
}
