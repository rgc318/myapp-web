import React from 'react';
import PartyManagementPage from '@/components/PartyManagementPage';
import {
  createSupplier,
  listSuppliers,
  setSupplierDisabled,
  updateSupplier,
} from '@/services/myapp/master-data';

const SuppliersPage: React.FC = () => (
  <PartyManagementPage
    createParty={createSupplier}
    defaultGroup="All Supplier Groups"
    listParties={listSuppliers}
    partyLabel="供应商"
    searchPlaceholder="供应商编码 / 名称 / 手机 / 邮箱"
    setPartyDisabled={setSupplierDisabled}
    updateParty={updateSupplier}
  />
);

export default SuppliersPage;
