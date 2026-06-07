import { Select } from 'antd';
import React, { useEffect, useState } from 'react';
import {
  type LinkOption,
  searchLinkOptions,
} from '@/services/myapp/master-data';

const PREFERRED_PAYMENT_MODES = ['微信支付', 'WeChat Pay', 'Cash', '现金'];

function pickPreferredPaymentMode(options: LinkOption[]) {
  return (
    PREFERRED_PAYMENT_MODES.map((mode) =>
      options.find((option) => option.value === mode),
    ).find(Boolean) ?? options[0]
  );
}

export function PaymentModeSelect({
  defaultValue = '',
  onChange,
}: {
  defaultValue?: string;
  onChange: (value: string) => void;
}) {
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState<LinkOption[]>([]);
  const [selectedValue, setSelectedValue] = useState(defaultValue);

  const loadOptions = async (query = '') => {
    setFetching(true);
    try {
      const nextOptions = await searchLinkOptions('Mode of Payment', query);
      setOptions(nextOptions);
      if (!selectedValue && !query) {
        const preferred = pickPreferredPaymentMode(nextOptions);
        if (preferred?.value) {
          setSelectedValue(preferred.value);
          onChange(preferred.value);
        }
      }
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    void loadOptions();
    // Run once when the modal mounts; later updates are driven by Select events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Select
      allowClear
      filterOption={false}
      loading={fetching}
      onChange={(nextValue) => {
        const normalizedValue = nextValue ?? '';
        setSelectedValue(normalizedValue);
        onChange(normalizedValue);
      }}
      onDropdownVisibleChange={(open) => {
        if (open && !options.length) {
          void loadOptions();
        }
      }}
      onSearch={(query) => {
        void loadOptions(query);
      }}
      optionFilterProp="label"
      options={options.map((option) => ({
        label: option.description
          ? `${option.label} (${option.description})`
          : option.label,
        value: option.value,
      }))}
      placeholder="选择付款方式，留空使用后端默认"
      showSearch
      style={{ width: '100%' }}
      value={selectedValue || undefined}
    />
  );
}
