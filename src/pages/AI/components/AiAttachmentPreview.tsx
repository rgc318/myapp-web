import { CloseOutlined, FileImageOutlined } from '@ant-design/icons';
import { Button, Image, Spin, Tooltip, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import {
  type AiAttachment,
  fetchAiAttachmentPreview,
} from '@/services/myapp/ai';

const useStyles = createStyles(({ css, token }) => ({
  error: css`
    align-items: center;
    background: ${token.colorFillAlter};
    color: ${token.colorTextSecondary};
    display: flex;
    flex-direction: column;
    gap: 4px;
    height: 100%;
    justify-content: center;
    padding: 6px;
    text-align: center;
    width: 100%;

    .anticon {
      font-size: 20px;
    }
  `,
  frame: css`
    background: ${token.colorFillAlter};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 12px;
    box-sizing: border-box;
    flex: 0 0 auto;
    overflow: hidden;
    position: relative;

    .ant-image,
    .ant-image-img {
      display: block;
      height: 100% !important;
      width: 100% !important;
    }

    .ant-image-img {
      object-fit: cover;
    }
  `,
  loading: css`
    align-items: center;
    display: flex;
    height: 100%;
    justify-content: center;
    width: 100%;
  `,
  remove: css`
    && {
      box-shadow: ${token.boxShadowTertiary};
      position: absolute;
      right: 4px;
      top: 4px;
      z-index: 2;
    }
  `,
}));

export function AiAttachmentPreview({
  attachment,
  disabled = false,
  onRemove,
  size = 80,
}: {
  attachment: AiAttachment;
  disabled?: boolean;
  onRemove?: () => void;
  size?: number;
}) {
  const { styles } = useStyles();
  const [previewSrc, setPreviewSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setPreviewSrc('');
    setFailed(false);

    void fetchAiAttachmentPreview(attachment.previewUrl)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewSrc(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.attachmentId, attachment.previewUrl]);

  return (
    <Tooltip title={attachment.filename}>
      <figure
        aria-label={attachment.filename}
        className={styles.frame}
        style={{ height: size, margin: 0, width: size }}
      >
        {failed ? (
          <div className={styles.error} role="img">
            <FileImageOutlined />
            <Typography.Text
              ellipsis
              style={{ maxWidth: '100%' }}
              type="secondary"
            >
              预览失败
            </Typography.Text>
          </div>
        ) : previewSrc ? (
          <Image alt={attachment.filename} preview src={previewSrc} />
        ) : (
          <div className={styles.loading}>
            <Spin size="small" />
          </div>
        )}
        {onRemove ? (
          <Button
            aria-label={`删除 ${attachment.filename}`}
            className={styles.remove}
            danger
            disabled={disabled}
            icon={<CloseOutlined />}
            onClick={onRemove}
            shape="circle"
            size="small"
          />
        ) : null}
      </figure>
    </Tooltip>
  );
}
