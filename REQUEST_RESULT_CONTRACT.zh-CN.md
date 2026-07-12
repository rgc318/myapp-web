# Web 请求结果处理约定

`@umijs/max` 的 `useRequest` 默认会把 service 返回值格式化为 `result?.data`。本项目的 `src/services/myapp/*` 领域 service 已经在 service 层完成 Frappe `message`、myapp gateway envelope 的解包，以及后端蛇形字段到页面驼峰字段的映射。

因此页面直接调用这些领域 service 时，应显式保留原始返回值：

```ts
const { data, error, loading, refresh } = useRequest(
  () => getSalesOrderDetail(orderName),
  {
    formatResult: (result) => result,
    refreshDeps: [orderName],
  },
);
```

如果不设置 `formatResult`，Umi 会继续读取 `SalesOrderDetail.data`，导致页面拿到 `undefined`，表现为详情页显示空态。

## 分层职责

- `api-client.ts`：处理 Frappe 外层 `message`、gateway envelope、HTTP/Axios 风格返回和错误对象。
- `sales.ts`、`purchase.ts`、`master-data.ts`、`reports.ts`：返回页面可直接消费的业务对象。
- 页面组件：只消费业务对象，不再读取后端原始包络或蛇形字段。

只有当 service 明确返回 `{ data: ... }` 包装对象时，才应依赖 Umi 默认 `result?.data` 行为。

## 写操作错误反馈

领域写操作统一通过 `services/myapp/mutation.ts`：

- 成功时显示简短成功消息。
- `MyAppApiError` 失败时按错误码显示右上角通知，正文使用后端业务消息。
- 同一个错误对象只通知一次，页面层再次捕获不会重复弹窗。
- helper 通知后仍会抛出异常，表单、确认框和按钮事件必须捕获，避免产生 `Uncaught (in promise)`。
- 能定位到字段的校验错误应同时调用 `form.setFields`，例如密码强度错误绑定到密码输入框；通知用于说明整体失败原因，字段错误用于指导用户修正。

推荐写法：

```ts
try {
  await createUser(values);
} catch (error) {
  form.setFields([{ name: 'password', errors: [getMutationErrorMessage(error)] }]);
  notifyMutationError(error);
}
```

`notifyMutationError` 内置错误对象去重，因此调用方不需要判断 helper 是否已经提示。
