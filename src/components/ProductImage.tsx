import { PictureOutlined } from '@ant-design/icons';
import { Image, theme } from 'antd';
import type { CSSProperties } from 'react';
import React, { useEffect, useState } from 'react';

export type ProductImageProps = {
  alt?: string;
  emptyText?: string;
  height?: number;
  objectFit?: CSSProperties['objectFit'];
  preview?: boolean;
  src?: string | null;
  style?: CSSProperties;
  width?: number;
};

export const ProductImage: React.FC<ProductImageProps> = ({
  alt = '商品图片',
  emptyText = '无图',
  height = 48,
  objectFit = 'cover',
  preview = false,
  src,
  style,
  width = 48,
}) => {
  const { token } = theme.useToken();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <Image
        alt={alt}
        height={height}
        onError={() => setFailed(true)}
        preview={preview}
        src={src}
        style={{ objectFit, ...style }}
        width={width}
      />
    );
  }

  const showText = Math.min(width, height) >= 56;

  return (
    <div
      aria-label={`${alt}：${emptyText}`}
      role="img"
      style={{
        alignItems: 'center',
        background: token.colorFillAlter,
        border: `1px dashed ${token.colorBorder}`,
        borderRadius: token.borderRadius,
        color: token.colorTextPlaceholder,
        display: 'flex',
        flex: '0 0 auto',
        flexDirection: 'column',
        fontSize: showText ? 12 : 16,
        gap: showText ? 2 : 0,
        height,
        justifyContent: 'center',
        lineHeight: 1.2,
        overflow: 'hidden',
        width,
        ...style,
      }}
    >
      <PictureOutlined />
      {showText ? <span>{emptyText}</span> : null}
    </div>
  );
};
