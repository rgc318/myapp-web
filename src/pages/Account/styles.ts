import { createStyles } from 'antd-style';

export const useAccountStyles = createStyles(({ css, token }) => ({
  capabilityItem: css`
    padding: 14px 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillAlter};
  `,
  contentCard: css`
    min-height: 560px;
  `,
  infoRow: css`
    display: flex;
    gap: 10px;
    align-items: flex-start;
    color: ${token.colorTextSecondary};

    .anticon {
      margin-top: 3px;
      color: ${token.colorPrimary};
    }
  `,
  profileBanner: css`
    height: 92px;
    margin: -24px -24px 0;
    border-radius: ${token.borderRadiusLG}px ${token.borderRadiusLG}px 0 0;
    background: linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorInfo} 100%);
  `,
  profileCard: css`
    overflow: hidden;
  `,
  profileHeader: css`
    margin-top: -46px;
    text-align: center;

    .ant-avatar {
      border: 4px solid ${token.colorBgContainer};
      box-shadow: ${token.boxShadowSecondary};
    }
  `,
  sectionDescription: css`
    margin: -8px 0 24px;
    color: ${token.colorTextSecondary};
  `,
  settingsMenu: css`
    .ant-menu {
      border-inline-end: 0 !important;
    }
  `,
  settingsShell: css`
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 24px;

    @media (max-width: 767px) {
      grid-template-columns: 1fr;
    }
  `,
  statCard: css`
    height: 100%;
  `,
}));
