import { Select } from 'antd';
import React, { useMemo } from 'react';
import { formatCurrencyCode } from '@/utils/myapp-display';

const COMMON_CURRENCIES = [
  'CNY',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'HKD',
  'SGD',
  'AUD',
  'CAD',
];

function optionLabel(currency: string) {
  const display = formatCurrencyCode(currency);
  return display === currency ? display : `${display} (${currency})`;
}

export function CurrencySelect({
  disabled,
  placeholder = '选择币种',
  style,
  value,
  onChange,
}: {
  disabled?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  value?: string | null;
  onChange?: (value: string) => void;
}) {
  const options = useMemo(() => {
    const normalizedValue = value?.trim().toUpperCase();
    const currencies =
      normalizedValue && !COMMON_CURRENCIES.includes(normalizedValue)
        ? [normalizedValue, ...COMMON_CURRENCIES]
        : COMMON_CURRENCIES;
    return currencies.map((currency) => ({
      label: optionLabel(currency),
      value: currency,
    }));
  }, [value]);

  return (
    <Select
      allowClear
      disabled={disabled}
      onChange={(nextValue) => onChange?.(nextValue)}
      options={options}
      placeholder={placeholder}
      showSearch
      style={style}
      value={value?.trim().toUpperCase() || undefined}
    />
  );
}
