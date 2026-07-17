import { createStyles } from 'antd-style';

export const useAiWorkspaceStyles = createStyles(({ css, token }) => ({
  brand: css`
    align-items: center;
    display: flex;
    gap: ${token.marginSM}px;
    min-width: 0;
  `,
  brandAvatar: css`
    background: linear-gradient(145deg, ${token.colorPrimary}, #7c3aed);
    box-shadow: 0 8px 24px color-mix(in srgb, ${token.colorPrimary} 28%, transparent);
    flex: 0 0 auto;
  `,
  brandCopy: css`
    min-width: 0;

    .ant-typography {
      display: block;
      margin: 0;
    }
  `,
  composer: css`
    background: linear-gradient(180deg, transparent, ${token.colorBgContainer} 24%);
    padding: ${token.paddingSM}px ${token.paddingLG}px ${token.paddingLG}px;
  `,
  composerInner: css`
    margin: 0 auto;
    max-width: 920px;

    .ant-sender {
      background: ${token.colorBgContainer};
      border-color: color-mix(in srgb, ${token.colorPrimary} 24%, ${token.colorBorder});
      border-radius: 20px;
      box-shadow: 0 12px 36px rgba(15, 23, 42, 0.12);
      padding: ${token.paddingSM}px;
    }

    .ant-sender:focus-within {
      border-color: ${token.colorPrimary};
      box-shadow: 0 14px 42px color-mix(in srgb, ${token.colorPrimary} 18%, transparent);
    }
  `,
  contextBar: css`
    align-items: center;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    display: flex;
    flex-wrap: wrap;
    gap: ${token.marginSM}px;
    justify-content: space-between;
    padding: ${token.paddingSM}px ${token.paddingXL}px;
  `,
  drawerContent: css`
    display: flex;
    flex-direction: column;
    gap: ${token.marginMD}px;
  `,
  emptyState: css`
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    margin: 0 auto;
    max-width: 820px;
    padding: ${token.paddingXL * 2}px ${token.paddingXL}px;
    width: 100%;

    .ant-welcome {
      background: transparent;
      padding-inline: 0;
      text-align: center;
    }
  `,
  generationIcon: css`
    align-items: center;
    background: color-mix(in srgb, ${token.colorPrimary} 12%, ${token.colorBgContainer});
    border-radius: 12px;
    color: ${token.colorPrimary};
    display: inline-flex;
    flex: 0 0 40px;
    font-size: 18px;
    height: 40px;
    justify-content: center;
    width: 40px;
  `,
  generationStatus: css`
    align-items: center;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, ${token.colorPrimary} 7%, ${token.colorBgContainer}),
      ${token.colorBgContainer}
    );
    border: 1px solid color-mix(in srgb, ${token.colorPrimary} 18%, ${token.colorBorderSecondary});
    border-radius: 16px;
    display: flex;
    gap: ${token.marginMD}px;
    min-width: min(420px, 100%);
    padding: ${token.paddingMD}px;
  `,
  inspector: css`
    background: ${token.colorBgContainer};
    border-left: 1px solid ${token.colorBorderSecondary};
    display: flex;
    flex: 0 0 300px;
    flex-direction: column;
    overflow-y: auto;
    padding: ${token.paddingMD}px;

    @media (max-width: ${token.screenXL}px) {
      display: none;
    }
  `,
  main: css`
    background: linear-gradient(180deg, ${token.colorBgContainer}, ${token.colorBgLayout});
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  `,
  messageBody: css`
    display: flex;
    flex-direction: column;
    gap: ${token.marginSM}px;
    max-width: 100%;
    min-width: 0;
  `,
  messages: css`
    background:
      radial-gradient(circle at 50% 0%, color-mix(in srgb, ${token.colorPrimary} 8%, transparent), transparent 36%),
      ${token.colorBgLayout};
    display: flex;
    flex: 1;
    justify-content: center;
    overflow-y: auto;
    padding: ${token.paddingXL}px ${token.paddingLG}px;

    > div {
      max-width: 920px;
      width: 100%;
    }

    .ant-bubble {
      margin-block-end: ${token.marginLG}px;
    }

    .ant-bubble-content {
      border-radius: 18px;
    }
  `,
  mobileOnly: css`
    display: none;

    @media (max-width: ${token.screenMD}px) {
      display: inline-flex;
    }
  `,
  page: css`
    .ant-pro-page-container-children-container {
      padding-block: 0;
    }
  `,
  promptGrid: css`
    margin-top: ${token.marginXL}px;
    width: 100%;
  `,
  sidebar: css`
    background: color-mix(in srgb, ${token.colorBgLayout} 72%, ${token.colorBgContainer});
    border-right: 1px solid ${token.colorBorderSecondary};
    display: flex;
    flex: 0 0 296px;
    flex-direction: column;
    overflow: hidden;

    @media (max-width: ${token.screenLG}px) {
      flex-basis: 228px;
    }

    @media (max-width: ${token.screenMD}px) {
      display: none;
    }
  `,
  sidebarBody: css`
    flex: 1;
    overflow-y: auto;
    padding: ${token.paddingSM}px;
  `,
  sidebarHeader: css`
    border-bottom: 1px solid ${token.colorBorderSecondary};
    display: flex;
    flex-direction: column;
    gap: ${token.marginSM}px;
    padding: ${token.paddingLG}px ${token.paddingMD}px ${token.paddingMD}px;
  `,
  sidebarTitle: css`
    align-items: center;
    display: flex;
    justify-content: space-between;
  `,
  sourceCards: css`
    display: grid;
    gap: ${token.marginSM}px;
  `,
  streamingLine: css`
    align-items: center;
    color: ${token.colorTextSecondary};
    display: flex;
    font-size: ${token.fontSizeSM}px;
    gap: ${token.marginXS}px;
    margin-top: ${token.marginXS}px;
  `,
  workspace: css`
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 20px;
    box-shadow: 0 18px 60px rgba(15, 23, 42, 0.1);
    display: flex;
    height: calc(100vh - 142px);
    min-height: 620px;
    overflow: hidden;
  `,
  workspaceHeader: css`
    align-items: center;
    background: color-mix(in srgb, ${token.colorBgContainer} 92%, transparent);
    border-bottom: 1px solid ${token.colorBorderSecondary};
    display: flex;
    justify-content: space-between;
    padding: ${token.paddingMD}px ${token.paddingXL}px;
  `,
}));
