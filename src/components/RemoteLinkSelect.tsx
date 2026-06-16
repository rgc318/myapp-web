import { Select } from 'antd';
import React, { useMemo, useState } from 'react';
import {
  type LinkOption,
  type LinkOptionFilters,
  searchLinkOptions,
} from '@/services/myapp/master-data';

function optionLabel(option: LinkOption) {
  return option.description
    ? `${option.label} (${option.description})`
    : option.label;
}

export function RemoteLinkSelect({
  disabled,
  doctype,
  extraFields,
  filters,
  limit = 20,
  placeholder,
  style,
  value,
  onChange,
}: {
  disabled?: boolean;
  doctype: string;
  extraFields?: string[];
  filters?: LinkOptionFilters;
  limit?: number;
  placeholder?: string;
  style?: React.CSSProperties;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState<LinkOption[]>([]);

  const loadOptions = async (query = '') => {
    setFetching(true);
    try {
      setOptions(
        await searchLinkOptions(doctype, query, extraFields, limit, filters),
      );
    } finally {
      setFetching(false);
    }
  };

  const selectOptions = useMemo(() => {
    const mapped = options.map((option) => ({
      label: optionLabel(option),
      value: option.value,
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
      onChange={(nextValue) => onChange?.(nextValue ?? '')}
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
