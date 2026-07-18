import { createStyles } from 'antd-style';

export const useAiWorkspaceStyles = createStyles(({ css, token }) => ({
  answerSummary: css`
    border-top: 1px solid ${token.colorBorderSecondary};
    display: flex;
    flex-direction: column;
    gap: ${token.marginXS}px;
    max-width: 880px;
    padding-top: ${token.paddingSM}px;
  `,
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
    flex: 0 0 auto;
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
    flex: 0 0 auto;
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
    min-height: 0;
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
    box-sizing: border-box;
    display: flex;
    flex: 1;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
    padding: ${token.paddingXL}px ${token.paddingLG}px;

    > .ant-bubble-list {
      flex: 1;
      height: 100%;
      max-width: 1220px;
      min-height: 0;
      width: 100%;
    }

    .ant-bubble-list-scroll-box {
      height: 100%;
      max-height: none;
      min-height: 0;
      overscroll-behavior: contain;
      overflow-y: auto;
      scrollbar-gutter: stable;
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
    display: flex;
    flex-direction: column;
    height: calc(100dvh - 56px);
    min-height: 0;
    overflow: hidden;

    > .ant-pro-grid-content {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    > .ant-pro-grid-content > .ant-pro-grid-content-children {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      width: 100%;
    }

    .ant-pro-page-container-children-container {
      box-sizing: border-box;
      display: flex;
      flex: 1;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
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
    min-height: 0;
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
    border-radius: 12px;
    box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
    display: flex;
    flex: 1;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  `,
  workspaceHeader: css`
    align-items: center;
    background: color-mix(in srgb, ${token.colorBgContainer} 92%, transparent);
    border-bottom: 1px solid ${token.colorBorderSecondary};
    display: flex;
    flex: 0 0 auto;
    justify-content: space-between;
    padding: ${token.paddingMD}px ${token.paddingXL}px;
  `,
}));
