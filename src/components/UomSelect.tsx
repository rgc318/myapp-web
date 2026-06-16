import { Select } from 'antd';
import React, { useMemo, useState } from 'react';
import { listUoms, type UomSummary } from '@/services/myapp/master-data';

function optionLabel(uom: UomSummary) {
  const display = uom.displayName || uom.uomName || uom.name;
  return display === uom.name ? display : `${display} (${uom.name})`;
}

export function UomSelect({
  disabled,
  placeholder = '选择单位',
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
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState<UomSummary[]>([]);

  const loadOptions = async (query = '') => {
    setFetching(true);
    try {
      const result = await listUoms({
        enabled: 1,
        limit: 40,
        searchKey: query,
      });
      setOptions(result.items);
    } finally {
      setFetching(false);
    }
  };

  const selectOptions = useMemo(() => {
    const mapped = options.map((uom) => ({
      label: optionLabel(uom),
      value: uom.name,
    }));
    if (value && !mapped.some((option) => option.value === value)) {
      return [{ label: value, value }, ...mapped];
    }
    return mapped;
  }, [options, value]);

  return (
    <Select
      allowClear
      disabled={disabled}
      filterOption={false}
      loading={fetching}
      onChange={(nextValue) => onChange?.(nextValue)}
      onDropdownVisibleChange={(open) => {
        if (open && !options.length) {
          void loadOptions();
        }
      }}
      onSearch={(query) => {
        void loadOptions(query);
      }}
      options={selectOptions}
      placeholder={placeholder}
      showSearch
      style={style}
      value={value || undefined}
    />
  );
}
