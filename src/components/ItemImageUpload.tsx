import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { Button, message, Space, Upload } from 'antd';
import React, { useState } from 'react';
import {
  deleteItemImage,
  replaceItemImage,
  uploadItemImage,
} from '@/services/myapp/media';
import { resolveMediaUrl } from '@/services/myapp/media-url';
import { ProductImage } from './ProductImage';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? (value.split(',').pop() ?? '') : value);
    };
    reader.readAsDataURL(file);
  });
}

function validateImage(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('图片请控制在 5MB 以内');
  }
}

export const ItemImageUpload: React.FC<{
  commitMode?: 'immediate' | 'staged';
  disabled?: boolean;
  itemCode?: string | null;
  onChange?: (fileUrl: string) => void;
  value?: string;
}> = ({ commitMode = 'staged', disabled, itemCode, onChange, value }) => {
  const [previewUrl, setPreviewUrl] = useState(resolveMediaUrl(value));
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  React.useEffect(() => {
    setPreviewUrl(resolveMediaUrl(value));
  }, [value]);

  const uploadProps: UploadProps = {
    accept: 'image/*',
    beforeUpload: async (file) => {
      setUploading(true);
      try {
        validateImage(file);
        const fileContentBase64 = await fileToBase64(file);
        const uploaded =
          itemCode && commitMode === 'immediate'
            ? await replaceItemImage({
                contentType: file.type,
                fileContentBase64,
                filename: file.name,
                itemCode,
              })
            : await uploadItemImage({
                contentType: file.type,
                fileContentBase64,
                filename: file.name,
              });

        setPreviewUrl(uploaded.previewUrl);
        onChange?.(uploaded.fileUrl);
      } catch (caught) {
        message.error(caught instanceof Error ? caught.message : '上传失败');
      } finally {
        setUploading(false);
      }
      return Upload.LIST_IGNORE;
    },
    disabled: disabled || uploading || deleting,
    maxCount: 1,
    showUploadList: false,
  };

  const handleDelete = async () => {
    if (!itemCode || commitMode === 'staged') {
      setPreviewUrl('');
      onChange?.('');
      return;
    }

    setDeleting(true);
    try {
      await deleteItemImage(itemCode);
      setPreviewUrl('');
      onChange?.('');
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Space align="start" size={12}>
      <ProductImage
        alt="商品图片"
        emptyText="无图片"
        height={96}
        preview
        src={previewUrl}
        width={96}
      />
      <Space orientation="vertical">
        <Upload {...uploadProps}>
          <Button
            disabled={disabled || deleting}
            icon={<UploadOutlined />}
            loading={uploading}
          >
            {previewUrl ? '替换图片' : '上传图片'}
          </Button>
        </Upload>
        <Button
          danger
          disabled={disabled || uploading || !previewUrl}
          icon={<DeleteOutlined />}
          loading={deleting}
          onClick={handleDelete}
        >
          删除图片
        </Button>
      </Space>
    </Space>
  );
};
