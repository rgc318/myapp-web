import { ProCard } from '@ant-design/pro-components';
import { Alert, Button, Empty, Skeleton } from 'antd';
import React from 'react';

export type PageStateProps = {
  empty?: boolean;
  emptyDescription?: React.ReactNode;
  error?: unknown;
  errorMessage?: string;
  loading?: boolean;
  onRetry?: () => void;
};

function getErrorDescription(error: unknown) {
  return error instanceof Error ? error.message : '请稍后重试。';
}

const PageState: React.FC<PageStateProps> = ({
  empty,
  emptyDescription = '暂无数据',
  error,
  errorMessage = '加载失败',
  loading,
  onRetry,
}) => {
  if (error) {
    return (
      <Alert
        action={
          onRetry ? (
            <Button size="small" onClick={onRetry}>
              重试
            </Button>
          ) : undefined
        }
        description={getErrorDescription(error)}
        message={errorMessage}
        showIcon
        type="error"
      />
    );
  }

  if (loading) {
    return (
      <ProCard>
        <Skeleton active paragraph={{ rows: 6 }} />
      </ProCard>
    );
  }

  if (empty) {
    return (
      <ProCard>
        <Empty description={emptyDescription} />
      </ProCard>
    );
  }

  return null;
};

export default PageState;
