import React from 'react';
import BusinessDocumentsTablePage from '@/components/BusinessDocumentsTablePage';

const PurchaseReceiptsPage: React.FC = () => (
  <BusinessDocumentsTablePage
    doctype="Purchase Receipt"
    partyLabel="供应商"
    searchPlaceholder="收货单号 / 供应商 / 公司"
    title="采购收货单"
  />
);

export default PurchaseReceiptsPage;
