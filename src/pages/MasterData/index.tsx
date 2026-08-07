import { PageLoading } from '@ant-design/pro-components';
import { history, useAccess } from '@umijs/max';
import { useEffect } from 'react';

export default function MasterDataIndexPage() {
  const access = useAccess() as Record<string, boolean>;

  useEffect(() => {
    const target = [
      ['canViewProducts', '/master-data/products'],
      ['canViewCustomers', '/master-data/customers'],
      ['canViewSuppliers', '/master-data/suppliers'],
      ['canViewUoms', '/master-data/uoms'],
      ['canViewWarehouses', '/master-data/warehouses'],
    ].find(([capability]) => access[capability]);

    history.replace(target?.[1] ?? '/dashboard');
  }, [
    access.canViewCustomers,
    access.canViewProducts,
    access.canViewSuppliers,
    access.canViewUoms,
    access.canViewWarehouses,
  ]);

  return <PageLoading />;
}
