import React from 'react';
import {
  getCurrentUserWorkspacePreferences,
  type WorkspacePreferences,
} from '@/services/myapp/workspace';

export const FALLBACK_COMPANY = 'rgc (Demo)';

export function useWorkspacePreferences() {
  const [preferences, setPreferences] =
    React.useState<WorkspacePreferences | null>(null);
  const [error, setError] = React.useState<unknown>();
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setPreferences(await getCurrentUserWorkspacePreferences());
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    defaultCompany: preferences?.defaultCompany || FALLBACK_COMPANY,
    defaultWarehouse: preferences?.defaultWarehouse || undefined,
    error,
    loading,
    preferences,
    refresh,
  };
}
