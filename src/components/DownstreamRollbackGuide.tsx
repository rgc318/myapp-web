import { Link } from '@umijs/max';
import { Alert, Space, Typography } from 'antd';
import React from 'react';

type LinkListProps = {
  basePath: string;
  emptyText: string;
  names: string[];
};

function InlineDocLinks({ basePath, emptyText, names }: LinkListProps) {
  if (!names.length) {
    return <Typography.Text type="secondary">{emptyText}</Typography.Text>;
  }

  return (
    <Space size={4} wrap>
      {names.map((name) => (
        <Link key={name} to={`${basePath}/${encodeURIComponent(name)}`}>
          {name}
        </Link>
      ))}
    </Space>
  );
}

export const SalesRollbackGuide: React.FC<{
  deliveryNotes: string[];
  salesInvoices: string[];
}> = ({ deliveryNotes, salesInvoices }) => (
  <Space orientation="vertical" size={10} style={{ width: '100%' }}>
    <Alert
      message="多单据场景请按顺序分步回退：先处理发票详情中的最近收款，再取消销售发票，最后取消销售发货单。"
      showIcon
      type="warning"
    />
    <div>
      <Typography.Text strong>销售发票：</Typography.Text>{' '}
      <InlineDocLinks
        basePath="/sales/invoices"
        emptyText="无"
        names={salesInvoices}
      />
    </div>
    <div>
      <Typography.Text strong>销售发货单：</Typography.Text>{' '}
      <InlineDocLinks
        basePath="/sales/delivery-notes"
        emptyText="无"
        names={deliveryNotes}
      />
    </div>
    <Typography.Text type="secondary">
      如果某张发票存在多笔收款，请进入发票详情逐笔取消最近收款，直到可以取消发票。
    </Typography.Text>
  </Space>
);

export const PurchaseRollbackGuide: React.FC<{
  purchaseInvoices: string[];
  purchaseReceipts: string[];
}> = ({ purchaseInvoices, purchaseReceipts }) => (
  <Space orientation="vertical" size={10} style={{ width: '100%' }}>
    <Alert
      message="多单据场景请按顺序分步回退：先处理发票详情中的最近付款，再取消采购发票，最后取消采购收货单。"
      showIcon
      type="warning"
    />
    <div>
      <Typography.Text strong>采购发票：</Typography.Text>{' '}
      <InlineDocLinks
        basePath="/purchase/invoices"
        emptyText="无"
        names={purchaseInvoices}
      />
    </div>
    <div>
      <Typography.Text strong>采购收货单：</Typography.Text>{' '}
      <InlineDocLinks
        basePath="/purchase/receipts"
        emptyText="无"
        names={purchaseReceipts}
      />
    </div>
    <Typography.Text type="secondary">
      如果某张发票存在多笔付款，请进入发票详情逐笔取消最近付款，直到可以取消发票。
    </Typography.Text>
  </Space>
);
