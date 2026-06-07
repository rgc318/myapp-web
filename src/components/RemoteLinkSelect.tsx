import { Select } from 'antd';
import React, { useState } from 'react';
import {
  type LinkOption,
  searchLinkOptions,
} from '@/services/myapp/master-data';

function optionLabel(option: LinkOption) {
  return option.description
    ? `${option.label} (${option.description})`
    : option.label;
}

export function RemoteLinkSelect({
  doctype,
  extraFields,
  placeholder,
  value,
  onChange,
}: {
  doctype: string;
  extraFields?: string[];
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState<LinkOption[]>([]);

  const loadOptions = async (query = '') => {
    setFetching(true);
    try {
      setOptions(await searchLinkOptions(doctype, query, extraFields));
    } finally {
      setFetching(false);
    }
  };

  return (
    <Select
      allowClear
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
      options={options.map((option) => ({
        label: optionLabel(option),
        value: option.value,
      }))}
      placeholder={placeholder}
      showSearch
      value={value || undefined}
    />
  );
}
