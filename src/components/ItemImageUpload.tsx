import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, message, Space, Typography } from 'antd';
import React, { useState } from 'react';
import {
  deleteItemImage,
  replaceItemImage,
  uploadItemImage,
} from '@/services/myapp/media';
import { resolveMediaUrl } from '@/services/myapp/media-url';
import {
  fileToBase64,
  formatBytes,
  ITEM_IMAGE_EDIT_PROFILE,
  type PreparedImage,
} from '@/utils/image-processing';
import { ImageEditorUpload } from './ImageEditorUpload';
import { ProductImage } from './ProductImage';

const { Text } = Typography;

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

  const handlePreparedImage = async (prepared: PreparedImage) => {
    setUploading(true);
    try {
      const fileContentBase64 = await fileToBase64(prepared.file);
      const uploaded =
        itemCode && commitMode === 'immediate'
          ? await replaceItemImage({
              contentType: prepared.mimeType,
              fileContentBase64,
              filename: prepared.file.name,
              itemCode,
            })
          : await uploadItemImage({
              contentType: prepared.mimeType,
              fileContentBase64,
              filename: prepared.file.name,
            });

      setPreviewUrl(uploaded.previewUrl);
      onChange?.(uploaded.fileUrl);
    } catch (caught) {
      throw caught instanceof Error ? caught : new Error('上传失败');
    } finally {
      setUploading(false);
    }
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
        <ImageEditorUpload
          disabled={disabled || uploading || deleting}
          onPrepared={handlePreparedImage}
          profile={ITEM_IMAGE_EDIT_PROFILE}
          sourceUrl={previewUrl}
        >
          <Button
            disabled={disabled || deleting}
            icon={<UploadOutlined />}
            loading={uploading}
          >
            {previewUrl ? '替换图片' : '上传图片'}
          </Button>
        </ImageEditorUpload>
        <Button
          danger
          disabled={disabled || uploading || !previewUrl}
          icon={<DeleteOutlined />}
          loading={deleting}
          onClick={handleDelete}
        >
          删除图片
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          JPG / PNG / WebP，原图最大 20MB
          <br />
          支持自由、1:1、4:3、3:2、16:9 裁剪，最长边 1600px，最大{' '}
          {formatBytes(ITEM_IMAGE_EDIT_PROFILE.maxOutputBytes)}
        </Text>
      </Space>
    </Space>
  );
};
