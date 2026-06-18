import { Tag } from 'antd';
import React from 'react';

export { formatDisplayUom, resolveDisplayUom } from './display-uom';

export function getCurrencyDisplayUnit(currency: string | null | undefined) {
  const normalized =
    typeof currency === 'string' ? currency.trim().toUpperCase() : '';

  switch (normalized) {
    case 'CNY':
    case 'RMB':
      return '元';
    case 'USD':
    case 'EUR':
    case 'GBP':
    case 'JPY':
    case 'HKD':
    case 'SGD':
    case 'AUD':
    case 'CAD':
      return normalized;
    default:
      return normalized || '元';
  }
}

export function formatCurrencyValue(
  value: number | string | null | undefined,
  currency: string | null | undefined = 'CNY',
) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '-';
  }

  return `${new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount)} ${getCurrencyDisplayUnit(currency)}`;
}

export function formatCurrencyCode(currency: string | null | undefined) {
  const unit = getCurrencyDisplayUnit(currency);
  return unit === '元' ? '人民币' : unit;
}

const statusLabelMap: Record<string, string> = {
  billed: '已开票',
  cancelled: '已作废',
  completed: '已完成',
  delivered: '已发货',
  draft: '草稿',
  overdue: '已逾期',
  paid: '已结清',
  partial: '部分完成',
  partially_billed: '部分开票',
  partially_delivered: '部分发货',
  partially_paid: '部分收款',
  partially_received: '部分收货',
  pending: '待处理',
  received: '已收货',
  shipped: '已发货',
  submitted: '已提交',
  to_bill: '待开票',
  to_deliver: '待发货',
  to_receive: '待收货',
  unpaid: '未结清',
};

const statusColorMap: Record<string, string> = {
  billed: 'green',
  cancelled: 'red',
  completed: 'green',
  delivered: 'green',
  draft: 'default',
  overdue: 'red',
  paid: 'green',
  partial: 'blue',
  partially_billed: 'blue',
  partially_delivered: 'blue',
  partially_paid: 'blue',
  partially_received: 'blue',
  pending: 'gold',
  received: 'green',
  shipped: 'green',
  submitted: 'blue',
  to_bill: 'gold',
  to_deliver: 'gold',
  to_receive: 'gold',
  unpaid: 'orange',
};

export function formatStatusLabel(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return '未知';
  }

  return statusLabelMap[normalized.toLowerCase()] ?? normalized;
}

export function StatusTag({
  label,
  value,
}: {
  label?: string;
  value: string | null | undefined;
}) {
  const normalized =
    typeof value === 'string' ? value.trim().toLowerCase() : '';

  return (
    <Tag color={statusColorMap[normalized] ?? 'default'}>
      {label ?? formatStatusLabel(value)}
    </Tag>
  );
}
