import React from 'react';
import BusinessDocumentsTablePage from '@/components/BusinessDocumentsTablePage';

const PurchaseInvoicesPage: React.FC = () => (
  <BusinessDocumentsTablePage
    doctype="Purchase Invoice"
    partyLabel="供应商"
    searchPlaceholder="发票号 / 供应商 / 公司"
    title="采购发票"
  />
);

export default PurchaseInvoicesPage;
