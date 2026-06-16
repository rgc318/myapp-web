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
