import React from 'react';
import BusinessDocumentsTablePage from '@/components/BusinessDocumentsTablePage';

const SalesInvoicesPage: React.FC = () => (
  <BusinessDocumentsTablePage
    doctype="Sales Invoice"
    partyLabel="客户"
    searchPlaceholder="发票号 / 客户 / 公司"
    title="销售发票"
  />
);

export default SalesInvoicesPage;
