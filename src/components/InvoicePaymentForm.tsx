import { Link } from '@umijs/max';
import {
  Alert,
  DatePicker,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Spin,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PaymentModeSelect } from '@/components/PaymentModeSelect';
import { formatCurrencyValue } from '@/utils/myapp-display';

export type InvoicePaymentDraft = {
  amount: number;
  modeOfPayment: string;
  referenceDate?: string;
  referenceName: string;
  referenceNo?: string;
  settlementMode?: 'partial' | 'writeoff';
};

type Props = {
  detailBasePath: string;
  invoices: string[];
  label: string;
  loadOutstandingAmount: (invoiceName: string) => Promise<number | null>;
  onChange: (draft: InvoicePaymentDraft) => void;
  showReferenceFields?: boolean;
  showSettlementMode?: boolean;
};

export const InvoicePaymentForm: React.FC<Props> = ({
  detailBasePath,
  invoices,
  label,
  loadOutstandingAmount,
  onChange,
  showReferenceFields = false,
  showSettlementMode = false,
}) => {
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modeOfPayment, setModeOfPayment] = useState('');
  const [outstandingAmount, setOutstandingAmount] = useState<number | null>(
    null,
  );
  const [referenceDate, setReferenceDate] = useState(
    dayjs().format('YYYY-MM-DD'),
  );
  const [referenceName, setReferenceName] = useState(invoices[0] ?? '');
  const [referenceNo, setReferenceNo] = useState('');
  const [settlementMode, setSettlementMode] =
    useState<InvoicePaymentDraft['settlementMode']>('partial');
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
        setSettlementMode('partial');
        onChange({
          amount: resolvedAmount,
          modeOfPayment: modeOfPaymentRef.current,
          referenceDate,
          referenceName,
          referenceNo,
          settlementMode: 'partial',
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
      referenceDate,
      referenceName,
      referenceNo,
      settlementMode,
      ...next,
    };
    onChange(draft);
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
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
            const nextSettlementMode =
              outstandingAmount !== null && nextAmount >= outstandingAmount
                ? 'partial'
                : settlementMode;
            setAmount(nextAmount);
            setSettlementMode(nextSettlementMode);
            updateDraft({
              amount: nextAmount,
              settlementMode: nextSettlementMode,
            });
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
      {showReferenceFields ? (
        <Space size={12} style={{ width: '100%' }}>
          <Input
            onChange={(event) => {
              const nextReferenceNo = event.target.value;
              setReferenceNo(nextReferenceNo);
              updateDraft({ referenceNo: nextReferenceNo });
            }}
            placeholder="收款参考号 / 流水号"
            value={referenceNo}
          />
          <DatePicker
            onChange={(value) => {
              const nextReferenceDate = value?.format('YYYY-MM-DD') ?? '';
              setReferenceDate(nextReferenceDate);
              updateDraft({ referenceDate: nextReferenceDate });
            }}
            style={{ width: 180 }}
            value={referenceDate ? dayjs(referenceDate) : undefined}
          />
        </Space>
      ) : null}
      {showSettlementMode &&
      outstandingAmount !== null &&
      amount > 0 &&
      amount < outstandingAmount ? (
        <Radio.Group
          onChange={(event) => {
            const nextSettlementMode = event.target
              .value as InvoicePaymentDraft['settlementMode'];
            setSettlementMode(nextSettlementMode);
            updateDraft({ settlementMode: nextSettlementMode });
          }}
          optionType="button"
          options={[
            { label: '保留未收余额', value: 'partial' },
            { label: '差额核销结清', value: 'writeoff' },
          ]}
          value={settlementMode}
        />
      ) : null}
    </Space>
  );
};
