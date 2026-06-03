# myapp Web 开发计划

本文档记录 Web 端从模板项目进入业务开发的实施计划。当前阶段目标是先建立稳定接入骨架，再逐步实现查询和报表页面。

## 阶段 0：模板清理与接入骨架

目标：

- 移除 Ant Design Pro 模板 API 假设
- 建立 JWT-only 的登录与请求基础设施
- 让后续页面不再关心 Frappe 外层响应和 token 刷新细节

任务：

- 配置 dev proxy 指向本地 Frappe 后端
- 新增 `auth-storage`
- 新增 `api-client`
- 新增 `auth` service
- 新增 `gateway` service
- 新增 `media-url` 工具
- 重写登录页为账号密码 + JWT 登录
- 替换 `getInitialState` 当前用户加载逻辑为 `me_v1`
- 清除 `?token=123` 请求拦截器
- 清理模板 mock API 对真实页面的影响
- 调整路由和菜单为业务页面

验收：

- `npm run dev` 可启动
- 登录成功后进入 `/dashboard`
- 刷新页面后仍保持登录态
- 手动删除 token 后自动跳回登录页
- 使用 Bearer Token 调通一个网关接口

## 阶段 1：首页和通用布局

目标：

- 提供业务入口和基础经营概览
- 形成稳定的桌面端信息架构

页面：

- `/dashboard`

接口：

- `myapp.api.gateway.get_business_report_overview_v1`
- 后续按需接入 `get_sales_report_v1`
- 后续按需接入 `get_purchase_report_v1`

任务：

- 首页 KPI 区
- 待处理单据摘要
- 销售 / 采购 / 财务 / 库存入口
- 页面 loading、empty、error 状态

验收：

- 首页不再显示模板欢迎页
- 后端不可用时有明确错误状态
- 页面可作为后续模块导航入口

## 阶段 2：销售查询模块

目标：

- 先完成销售单据查询和详情，不复制移动端开单流程

页面：

- `/sales/orders`
- `/sales/orders/:name`
- 后续可扩展 `/sales/deliveries/:name`
- 后续可扩展 `/sales/invoices/:name`

接口：

- `myapp.api.gateway.search_sales_orders_v2`
- `myapp.api.gateway.get_sales_order_detail`
- `myapp.api.gateway.get_delivery_note_detail_v2`
- `myapp.api.gateway.get_sales_invoice_detail_v2`
- `myapp.api.gateway.get_sales_order_status_summary`

任务：

- 销售订单列表
- 公司、客户、日期、状态筛选
- 订单详情
- 下游发货单、发票、收款引用展示
- 商品图片通过 `resolveMediaUrl` 显示

验收：

- 能按条件查询销售订单
- 能打开订单详情
- 能看到履约、开票、收款摘要
- 不在页面内写死 `/files` 图片路径

## 阶段 3：采购查询模块

目标：

- 完成采购单据查询和详情

页面：

- `/purchase/orders`
- `/purchase/orders/:name`
- 后续可扩展 `/purchase/receipts/:name`
- 后续可扩展 `/purchase/invoices/:name`

接口：

- `myapp.api.gateway.search_purchase_orders_v2`
- `myapp.api.gateway.get_purchase_order_detail_v2`
- `myapp.api.gateway.get_purchase_receipt_detail_v2`
- `myapp.api.gateway.get_purchase_invoice_detail_v2`
- `myapp.api.gateway.get_purchase_order_status_summary`

任务：

- 采购订单列表
- 公司、供应商、日期、状态筛选
- 采购订单详情
- 下游收货单、发票、付款引用展示

验收：

- 能按条件查询采购订单
- 能打开采购订单详情
- 能看到收货、开票、付款摘要

## 阶段 4：收付款与财务查询

目标：

- 给财务人员提供应收、应付、资金流水的查询入口

页面：

- `/payments`
- `/finance`

接口：

- `myapp.api.gateway.get_receivable_payable_report_v1`
- `myapp.api.gateway.get_cashflow_report_v1`
- `myapp.api.gateway.list_cashflow_entries_v1`

任务：

- 收付款流水列表
- 应收 / 应付切换
- 日期和公司筛选
- 客户 / 供应商维度摘要
- 资金趋势摘要

验收：

- 能区分收款、付款和资金流水
- 能查看未结金额和结算状态
- 分页和筛选稳定

## 阶段 5：库存查询

目标：

- 提供库存流水和商品库存查询能力

页面：

- `/inventory-ledger`
- 后续可扩展 `/products`

接口：

- 优先使用后端薄查询接口
- 商品辅助可使用 `myapp.api.gateway.list_products_v2`
- 商品详情可使用 `myapp.api.gateway.get_product_detail_v2`

任务：

- 库存流水列表
- 商品、仓库、日期筛选
- 凭证类型和凭证编号跳转
- 商品库存摘要

验收：

- 能按商品和仓库查询库存变化
- 能从库存流水定位来源单据

## 阶段 6：主数据辅助页

目标：

- 补齐 Web 查询页面需要的主数据入口，但不扩展成完整 ERP 管理后台

页面：

- `/customers`
- `/suppliers`
- `/products`
- `/uoms`

接口：

- `myapp.api.gateway.list_customers_v2`
- `myapp.api.gateway.get_customer_detail_v2`
- `myapp.api.gateway.list_suppliers_v2`
- `myapp.api.gateway.get_supplier_detail_v2`
- `myapp.api.gateway.list_products_v2`
- `myapp.api.gateway.get_product_detail_v2`
- `myapp.api.gateway.list_uoms_v2`
- `myapp.api.gateway.get_uom_detail_v2`

任务：

- 列表和详情优先
- 新增 / 编辑 / 停用能力按实际运营需要再开放
- 避免第一阶段把主数据维护做成范围过大的后台项目

验收：

- 查询页筛选所需主数据可复用
- 详情字段与移动端联调字段保持一致

## 阶段 7：写操作增强

目标：

- 在 Web 端补充管理人员需要的少量动作，不复制移动端完整操作流

候选动作：

- 取消销售订单
- 取消采购订单
- 确认待处理单据
- 取消付款
- 轻量主数据编辑

接口：

- `myapp.api.gateway.cancel_order_v2`
- `myapp.api.gateway.cancel_purchase_order_v2`
- `myapp.api.gateway.confirm_pending_document`
- `myapp.api.gateway.cancel_payment_entry`
- `myapp.api.gateway.cancel_supplier_payment`

要求：

- 所有写操作必须使用 `Idempotency-Key`
- 所有写操作必须有二次确认
- 成功后刷新列表和详情缓存
- 失败时展示后端 `code` 和 `message`

## 优先级建议

推荐顺序：

1. 阶段 0：模板清理与 JWT 接入
2. 阶段 1：首页和通用布局
3. 阶段 2：销售查询模块
4. 阶段 3：采购查询模块
5. 阶段 4：收付款与财务查询
6. 阶段 5：库存查询
7. 阶段 6：主数据辅助页
8. 阶段 7：写操作增强

当前最关键的是阶段 0。只要阶段 0 做稳，后续页面基本是按接口映射推进，不会再因为认证、代理、错误格式和模板服务返工。

## 与云存储的关系

Web 开发不等待云存储集成。

当前约定：

- Web 只消费后端返回的图片 / 文件 URL
- Web 使用 `resolveMediaUrl`
- Web 不直接上传到云存储
- Web 不拼接 OSS/S3/MinIO 地址
- 后续云存储由后端 `media_service` 和公共工具包承接

因此云存储可以在移动端和 Web 查询页稳定后统一适配，不阻塞当前 Web 阶段。

