import { Link } from '@umijs/max';
import { Alert, InputNumber, Select, Space, Spin } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PaymentModeSelect } from '@/components/PaymentModeSelect';
import { formatCurrencyValue } from '@/utils/myapp-display';

export type InvoicePaymentDraft = {
  amount: number;
  modeOfPayment: string;
  referenceName: string;
};

type Props = {
  detailBasePath: string;
  invoices: string[];
  label: string;
  loadOutstandingAmount: (invoiceName: string) => Promise<number | null>;
  onChange: (draft: InvoicePaymentDraft) => void;
};

export const InvoicePaymentForm: React.FC<Props> = ({
  detailBasePath,
  invoices,
  label,
  loadOutstandingAmount,
  onChange,
}) => {
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modeOfPayment, setModeOfPayment] = useState('');
  const [outstandingAmount, setOutstandingAmount] = useState<number | null>(
    null,
  );
  const [referenceName, setReferenceName] = useState(invoices[0] ?? '');
  const modeOfPaymentRef = useRef('');

  const options = useMemo(
    () => invoices.map((name) => ({ label: name, value: name })),
    [invoices],
  );

  useEffect(() => {
    if (!referenceName) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    void loadOutstandingAmount(referenceName)
      .then((nextOutstandingAmount) => {
        if (cancelled) {
          return;
        }
        const resolvedAmount = Math.max(Number(nextOutstandingAmount ?? 0), 0);
        setOutstandingAmount(resolvedAmount);
        setAmount(resolvedAmount);
        onChange({
          amount: resolvedAmount,
          modeOfPayment: modeOfPaymentRef.current,
          referenceName,
        });
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadOutstandingAmount, referenceName]);

  const updateDraft = (next: Partial<InvoicePaymentDraft>) => {
    const draft = {
      amount,
      modeOfPayment,
      referenceName,
      ...next,
    };
    onChange(draft);
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Select
        disabled={invoices.length <= 1}
        onChange={(value) => {
          setReferenceName(value);
          updateDraft({ referenceName: value });
        }}
        options={options}
        placeholder={`选择${label}`}
        value={referenceName || undefined}
      />
      {referenceName ? (
        <Link to={`${detailBasePath}/${encodeURIComponent(referenceName)}`}>
          打开{label}详情
        </Link>
      ) : null}
      <Spin spinning={loading}>
        <InputNumber
          autoFocus
          controls={false}
          disabled={!referenceName || loading}
          max={outstandingAmount ?? undefined}
          min={0.01}
          onChange={(value) => {
            const nextAmount = Number(value ?? 0);
            setAmount(nextAmount);
            updateDraft({ amount: nextAmount });
          }}
          precision={2}
          prefix="¥"
          style={{ width: '100%' }}
          value={amount || undefined}
        />
      </Spin>
      {outstandingAmount !== null ? (
        <Alert
          message={`${label}未结金额：${formatCurrencyValue(outstandingAmount)}`}
          showIcon
          type="info"
        />
      ) : null}
      <PaymentModeSelect
        onChange={(value) => {
          modeOfPaymentRef.current = value;
          setModeOfPayment(value);
          updateDraft({ modeOfPayment: value });
        }}
      />
    </Space>
  );
};
