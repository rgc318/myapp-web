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

当前状态：

- 已完成 `auth-storage`、`auth`、`api-client`、`gateway`、`media-url` 基础文件。
- 已接入 JWT 登录、当前用户恢复、登出和业务请求 Bearer Token。
- 已移除模板请求拦截器中的 `?token=123` 行为。
- 已配置 dev proxy 指向本地 Frappe 的 `/api/method/`。
- 已新增 `.env.example`，本地 `.env.local` 用于开发账号自动填充，不提交。
- 已修复一次登录页停在 `正在加载资源` 的问题：认证接口不再依赖 Umi request，避免启动期循环依赖；必要时清理 `src/.umi` 和 `node_modules/.cache` 后重启 dev server。
- 已补充本地端口排障：固定 `8001` 时应使用 `npm run start:dev -- --port 8001`，并以启动日志 `App listening at` 为准。
- 已关闭模板默认 PWA 缓存；localhost 下会清理旧 service worker/cache，避免旧 chunk 导致页面停在 `正在加载资源`。
- 已将 request 错误处理从模板 `success` 假设收窄为兼容逻辑，并识别 myapp 网关 `{ ok: false, code, message }` 错误包络。
- 已新增 `api-utils.ts`，统一数字、文本、分页和列表包络解析。
- 已新增 `api-base.ts`，生产环境可通过 `MYAPP_WEB_API_BASE_URL` 指定 API base，默认同域 `/api/method/...`。
- 已统一 token header：业务请求由 request interceptor 自动携带 Bearer token，页面和 domain service 不手动传 token。
- 已扩展 `src/access.ts` 权限点：销售、采购、财务、库存、报表、主数据。
- 已新增 `src/components/PageState`，统一 loading、empty、error、retry 状态。
- 已新增 `src/utils/myapp-display.tsx`，统一状态中文标签、金额 / 币种单位和计量单位展示，规则参考 mobile 端已有处理。
- 已新增 `src/services/myapp/mutation.ts`，为后续 Web 写操作提供幂等 key 执行模式。
- 已补基础层 Jest 测试：api-client、auth-storage、api-utils、access、sales/purchase/reports/master-data 字段映射。

仍需收尾：

- 浏览器端人工确认强制刷新后的登录、登出、刷新页面恢复登录态。
- 按业务菜单逐步替换模板菜单和路由，不一次性大删模板页面。
- 根据实际后端角色定义细化前端菜单权限。

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

当前状态：

- `/dashboard` 已添加为根路由目标。
- 第一版经营概览已接入 `get_business_report_overview_v1`。
- 已具备 loading、error、empty 和刷新按钮。
- UI 仍使用 ProComponents 基础组件，后续在不大幅破坏模板结构的前提下逐步企业化。

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

当前状态：

- 已新增 `/sales/orders` 销售订单列表。
- 已新增 `/sales/orders/:name` 销售订单详情。
- 已新增 `src/services/myapp/sales.ts`，对 `search_sales_orders_v2`、`get_sales_order_detail`、`get_delivery_note_detail_v2` 和 `get_sales_invoice_detail_v2` 做页面侧字段规范化。
- 已接入菜单文案“销售查询 / 销售订单”。
- 已通过 `npm run tsc`、`npm run biome:lint` 和 `npm run build`。
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

当前状态：

- 已新增 `src/services/myapp/purchase.ts`。
- 已覆盖 `search_purchase_orders_v2`、`get_purchase_order_detail_v2`、`get_purchase_receipt_detail_v2` 和 `get_purchase_invoice_detail_v2` 的 Web 查询模型。
- 已新增 `/purchase/orders` 采购订单列表。
- 已新增 `/purchase/orders/:name` 采购订单详情。
- 已接入采购菜单，使用现有 `canViewPurchase` 权限点。
- 采购列表已支持关键词、公司、日期、状态、排序、分页和汇总卡片。
- 采购详情已支持金额汇总、基本信息、供应商信息、关联收货单 / 发票和商品明细展示。
- 已通过 `npm run tsc`、`npm run biome:lint` 和 `npm run build`。

## 阶段 4：收付款与财务查询

目标：

- 给财务人员提供应收、应付、资金流水的查询入口

页面：

- `/reports`
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

当前状态：

- 已新增 `src/services/myapp/reports.ts`。
- 已覆盖经营概览、销售报表、采购报表、应收应付报表、资金趋势和资金流水分页。
- 已新增 `/reports` 经营报表入口页。
- `/reports` 已接入 `get_business_report_overview_v1`，支持公司、日期筛选，展示销售 / 采购 / 现金流 / 应收应付 KPI，以及客户、供应商、商品、趋势小表。
- 已新增 `/payments` 收付款流水查询页。
- `/payments` 已接入 `list_cashflow_entries_v1`，支持公司、日期和分页查询，展示收款 / 付款 / 转账方向、往来方、付款方式、金额和参考号。
- 已新增 `/finance` 财务查询页。
- `/finance` 已接入 `get_receivable_payable_report_v1`，支持公司、日期查询，按客户应收 / 供应商应付切换展示总额、未结金额和往来方摘要。
- 已通过 `npm run tsc`、`npm run biome:lint` 和 `npm run build`。

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

当前状态：

- 已新增 `src/services/myapp/master-data.ts`。
- 已覆盖商品、客户、供应商和 UOM 的列表/详情查询模型，可支撑后续商品查询页和筛选选择器。
- 已新增 `/master-data/products` 商品列表。
- 已新增 `/master-data/customers` 客户列表。
- 已新增 `/master-data/suppliers` 供应商列表。
- 已新增 `/master-data/uoms` 计量单位列表。
- 当前主数据页面只做查询辅助，不开放新增、编辑和停用操作。
- 已新增 `/inventory-ledger` 库存流水页。
- 后端已新增 `myapp.api.gateway.list_stock_ledger_entries_v1`。
- 当前页面已接入真实 `Stock Ledger Entry` 明细流水，支持公司、商品、仓库、日期、凭证类型和凭证编号筛选。

## 阶段 7：写操作增强

目标：

- 在 Web 端补充管理人员需要的少量动作，不复制移动端完整操作流

候选动作：

- 创建销售发货单
- 创建销售发票
- 登记销售收款
- 创建采购收货单
- 创建采购发票
- 登记采购付款
- 取消销售订单
- 取消采购订单
- 取消销售发货单
- 取消销售发票
- 取消采购收货单
- 取消采购发票
- 确认待处理单据
- 取消最近收款
- 取消最近付款
- 轻量主数据编辑

接口：

- `myapp.api.gateway.create_delivery_note`
- `myapp.api.gateway.create_sales_invoice`
- `myapp.api.gateway.record_payment`
- `myapp.api.gateway.receive_purchase_order`
- `myapp.api.gateway.create_purchase_invoice`
- `myapp.api.gateway.record_supplier_payment`
- `myapp.api.gateway.cancel_order_v2`
- `myapp.api.gateway.cancel_purchase_order_v2`
- `myapp.api.gateway.cancel_delivery_note`
- `myapp.api.gateway.cancel_sales_invoice`
- `myapp.api.gateway.cancel_purchase_receipt`
- `myapp.api.gateway.cancel_purchase_invoice`
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

当前阶段 0、阶段 1、阶段 2 和阶段 3 的基础查询页面已经完成到可以继续业务页面开发的状态。后续页面基本是按接口映射推进，不应再因为认证、代理、错误格式和模板服务返工。

阶段 7 已完成第一批高频写操作：销售 / 采购订单详情可按日期和备注创建发货 / 收货单、创建发票、按金额和付款方式登记收付款并取消订单；销售发货单、销售发票、采购收货单、采购发票详情可取消单据；销售 / 采购发票详情可取消最近收款 / 付款。后续阶段 7 仍可继续补待处理确认、更完整的下游单据参数和主数据轻量编辑。

当前交接摘要：

- 前端 `main` 本地比 `origin/main` ahead 4，包含水印开关、中文应用框架、业务展示统一和 dev server 清理文档。
- 后端 `apps/myapp` 在 `develop`，当前工作区干净并已同步远端。
- 本轮完整验证已通过：Jest 关键测试、`npm run tsc`、`npm run biome:lint`、`npm run build`、`git diff --check`。
- 下一会话优先确认是否推送前端 ahead 提交，然后做浏览器联调和销售 / 采购写操作状态刷新验证。

## 当前骨架完成状态

已完成：

- Web JWT 登录链路：`login_v1`、`me_v1`、`refresh_v1`、`logout_v1`。
- 应用标题、PWA 名称、菜单、登录页标题和页脚已改为中文业务后台文案。
- 模板路由 `/welcome`、`/admin`、`/list` 暂时保留但已从菜单隐藏。
- 认证接口改为原生 `fetch`，避免 Umi request 运行时循环依赖导致页面卡在 `正在加载资源`。
- 统一 token 存储和请求注入：业务页面和 domain service 不需要手动拼 `Authorization`。
- 统一 API base：默认同域 `/api/method/...`，生产或跨域部署可用 `MYAPP_WEB_API_BASE_URL`。
- Umi dev proxy：`/api/method/` 代理到 `MYAPP_WEB_PROXY_TARGET`，默认 `http://localhost:8080`。
- 页面水印开关：`MYAPP_WEB_ENABLE_WATERMARK`，默认本地 dev 关闭、生产开启。
- Web API 分层：`api-client`、`gateway`、`reports`、`sales`、`purchase`、`master-data`、`mutation`。
- 通用页面状态组件：loading、empty、error、retry。
- 通用业务展示工具：状态中文标签、金额 / 币种单位、计量单位。
- 基础权限点：销售、采购、财务、库存、报表、主数据。
- 幂等写操作 helper：取消、确认、付款等动作统一使用 `Idempotency-Key`。
- PWA 默认关闭，并在 localhost 清理旧 service worker/cache，避免开发期命中过期资源。
- `/dashboard`、`/sales/orders`、`/sales/orders/:name`、`/purchase/orders`、`/purchase/orders/:name` 已作为第一批真实业务页面接入。
- 基础测试：API client、token storage、字段映射、权限、登录页 JWT 行为。
- 生产部署说明：同域部署、Nginx/Caddy 示例、缓存策略和上线验收。

未完成但不阻塞继续开发：

- Ant Design Pro 模板页面、模板服务和模板视觉元素尚未系统清理。
- 手机号登录、第三方登录图标仍保留模板视觉占位，当前真实登录只走账号密码 JWT。
- Web 端第一批写操作已接入；复杂下游单据参数、待处理确认和主数据编辑尚未接入。
- 真实权限策略仍按 ERPNext 常见角色宽松匹配，后续需要按实际角色清单收紧。
- 跨域生产部署未实测，第一阶段推荐同域反向代理。

当前本地服务建议：

- 只保留一个 Web dev server。
- 首选端口 `8001`，命令：`npm run start:dev -- --port 8001`。
- 如果端口被旧进程占用，先清理旧进程；不要同时开多个相同前端服务。
- 清理旧服务前先用 `lsof -nP -iTCP:<port> -sTCP:LISTEN` 确认 PID 和命令行；如果当前工具会话查不到 PID，回到启动旧服务的宿主终端 `Ctrl+C`，不要盲杀不明进程。
- 验证 `/umi.js` 的 `content_type` 必须是 `application/javascript`，如果是 `text/html`，浏览器会停在加载占位页。

下一步建议：

- 做真实浏览器联调，验证销售 / 采购创建下游单据、登记收付款、取消订单和取消下游单据后的后端单据状态刷新。
- 继续增强销售 / 采购动作表单，支持部分数量；付款方式后续可从手工输入升级为后端选项接口。
- `/payments` 后续等后端支持后可补方向、付款方式和往来方筛选。
- `/inventory-ledger` 后续可补凭证跳转、商品选择器和仓库选择器。
- 报表页后续可按真实使用反馈补图表、钻取和导出。
- UI 风格先沿用 Ant Design Pro，不做大面积重绘。

## 与云存储的关系

Web 开发不等待云存储集成。

当前约定：

- Web 只消费后端返回的图片 / 文件 URL
- Web 使用 `resolveMediaUrl`
- Web 不直接上传到云存储
- Web 不拼接 OSS/S3/MinIO 地址
- 后续云存储由后端 `media_service` 和公共工具包承接

因此云存储可以在移动端和 Web 查询页稳定后统一适配，不阻塞当前 Web 阶段。
