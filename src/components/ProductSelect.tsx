import { Select } from 'antd';
import React, { useState } from 'react';
import {
  listProducts,
  type ProductSummary,
} from '@/services/myapp/master-data';

export function ProductSelect({
  company,
  placeholder = '搜索商品名称、编码、条码',
  style,
  warehouse,
  onSelectProduct,
}: {
  company?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  warehouse?: string;
  onSelectProduct: (product: ProductSummary) => void;
}) {
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState<ProductSummary[]>([]);

  const loadProducts = async (query = '') => {
    setFetching(true);
    try {
      const result = await listProducts({
        company,
        limit: 20,
        searchKey: query,
        warehouse,
      });
      setOptions(result.items);
    } finally {
      setFetching(false);
    }
  };

  return (
    <Select
      filterOption={false}
      loading={fetching}
      onDropdownVisibleChange={(open) => {
        if (open && !options.length) {
          void loadProducts();
        }
      }}
      onSearch={(query) => {
        void loadProducts(query);
      }}
      onSelect={(itemCode) => {
        const product = options.find((item) => item.itemCode === itemCode);
        if (product) {
          onSelectProduct(product);
        }
      }}
      options={options.map((item) => ({
        label: `${item.itemName || item.itemCode} (${item.itemCode})`,
        value: item.itemCode,
      }))}
      placeholder={placeholder}
      showSearch
      style={style}
      value={undefined}
    />
  );
}
