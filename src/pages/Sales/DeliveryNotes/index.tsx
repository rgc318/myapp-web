import React from 'react';
import BusinessDocumentsTablePage from '@/components/BusinessDocumentsTablePage';

const SalesDeliveryNotesPage: React.FC = () => (
  <BusinessDocumentsTablePage
    doctype="Delivery Note"
    partyLabel="客户"
    searchPlaceholder="发货单号 / 客户 / 公司"
    title="销售发货单"
  />
);

export default SalesDeliveryNotesPage;
