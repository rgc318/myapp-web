import React from 'react';
import PartyManagementPage from '@/components/PartyManagementPage';
import {
  createCustomer,
  getCustomerDetail,
  listCustomers,
  setCustomerDisabled,
  updateCustomer,
} from '@/services/myapp/master-data';

const CustomersPage: React.FC = () => (
  <PartyManagementPage
    createParty={createCustomer}
    defaultGroup="Commercial"
    getPartyDetail={getCustomerDetail}
    listParties={listCustomers}
    partyLabel="客户"
    searchPlaceholder="客户编码 / 名称 / 手机 / 邮箱"
    setPartyDisabled={setCustomerDisabled}
    updateParty={updateCustomer}
  />
);

export default CustomersPage;
