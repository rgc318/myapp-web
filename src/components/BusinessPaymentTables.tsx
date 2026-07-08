import type { ProColumns } from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import { Button } from 'antd';
import React from 'react';
import { paymentEntryPath } from '@/utils/business-document';
import { formatCurrencyValue } from '@/utils/myapp-display';

export type BusinessPaymentEntry = {
  allocatedAmount?: number | null;
  amount?: number | null;
  date?: string | null;
  modeOfPayment?: string | null;
  paymentEntry: string;
  postingDate?: string | null;
  referenceName?: string | null;
};

export function buildPaymentEntryColumns<T extends BusinessPaymentEntry>({
  actualAmountKey,
  actualAmountTitle,
  currency,
  dateKey = 'date',
  dateTitle,
  entryTitle,
  extraColumns = [],
  showAllocatedAmount = true,
}: {
  actualAmountKey: keyof T;
  actualAmountTitle: string;
  currency?: string;
  dateKey?: keyof T;
  dateTitle: string;
  entryTitle: string;
  extraColumns?: ProColumns<T>[];
  showAllocatedAmount?: boolean;
}): ProColumns<T>[] {
  const columns: ProColumns<T>[] = [
    {
      title: entryTitle,
      dataIndex: 'paymentEntry',
      width: 180,
      render: (_, record) =>
        record.paymentEntry ? (
          <Link to={paymentEntryPath(record.paymentEntry)}>
            {record.paymentEntry}
          </Link>
        ) : (
          '-'
        ),
    },
    {
      title: dateTitle,
      dataIndex: String(dateKey),
      width: 110,
      render: (_, record) => String(record[dateKey] || '-'),
    },
    {
      title: '付款方式',
      dataIndex: 'modeOfPayment',
      width: 120,
      render: (_, record) => record.modeOfPayment || '-',
    },
  ];

  if (showAllocatedAmount) {
    columns.push({
      title: '核销金额',
      dataIndex: 'allocatedAmount',
      align: 'right',
      width: 120,
      render: (_, record) =>
        formatCurrencyValue(record.allocatedAmount, currency),
    });
  }

  columns.push(
    {
      title: actualAmountTitle,
      dataIndex: String(actualAmountKey),
      align: 'right',
      width: 120,
      render: (_, record) =>
        formatCurrencyValue(record[actualAmountKey] as number | null, currency),
    },
    ...extraColumns,
  );

  return columns;
}

export function buildPaymentActionColumn<T extends BusinessPaymentEntry>({
  disabled,
  loading,
  onCancelPayment,
  title = '操作',
  width = 120,
  cancelText,
}: {
  cancelText: React.ReactNode | ((record: T) => React.ReactNode);
  disabled?: boolean | ((record: T) => boolean);
  loading?: boolean | ((record: T) => boolean);
  onCancelPayment: (record: T) => void;
  title?: string;
  width?: number;
}): ProColumns<T> {
  return {
    title,
    fixed: 'right',
    valueType: 'option',
    width,
    render: (_, record) => (
      <Button
        danger
        disabled={
          !record.paymentEntry ||
          (typeof disabled === 'function'
            ? disabled(record)
            : Boolean(disabled))
        }
        loading={typeof loading === 'function' ? loading(record) : loading}
        onClick={() => onCancelPayment(record)}
        size="small"
        type="link"
      >
        {typeof cancelText === 'function' ? cancelText(record) : cancelText}
      </Button>
    ),
  };
}

export function purchaseInvoiceReferenceColumn<
  T extends BusinessPaymentEntry,
>(): ProColumns<T> {
  return {
    title: '采购发票',
    dataIndex: 'referenceName',
    ellipsis: true,
    width: 170,
    render: (_, record) =>
      record.referenceName ? (
        <Link
          to={`/purchase/invoices/${encodeURIComponent(record.referenceName)}`}
        >
          {record.referenceName}
        </Link>
      ) : (
        '-'
      ),
  };
}
