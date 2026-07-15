import { PageLoading } from '@ant-design/pro-components';
import { history, useAccess } from '@umijs/max';
import { useEffect } from 'react';

export default function AdministrationIndexPage() {
  const access = useAccess() as Record<string, boolean>;

  useEffect(() => {
    if (access.canAdmin) {
      history.replace('/administration/users');
      return;
    }
    if (access.canViewAiGovernance) {
      history.replace('/administration/ai/models');
      return;
    }
    history.replace('/administration/ai/data-tasks');
  }, [access.canAdmin, access.canViewAiGovernance]);

  return <PageLoading />;
}
