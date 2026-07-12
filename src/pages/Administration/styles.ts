import { createStyles } from 'antd-style';

export const useAdministrationStyles = createStyles(({ css, token }) => ({
  identityCell: css`
    display: flex;
    gap: 12px;
    align-items: center;
    min-width: 220px;
  `,
  muted: css`
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  pageStack: css`
    display: flex;
    flex-direction: column;
    gap: 24px;
  `,
  roleName: css`
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 180px;
  `,
  summaryCard: css`
    height: 100%;
  `,
}));
