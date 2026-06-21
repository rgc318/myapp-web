# Web Development

Chinese implementation docs:

- `WEB_DEVELOPMENT.zh-CN.md`: JWT-only backend integration and page/API mapping
- `DEVELOPMENT_PLAN.zh-CN.md`: phased Web implementation plan
- `REQUEST_RESULT_CONTRACT.zh-CN.md`: `useRequest` result formatting and domain service return contract

## Role

`myapp-web` is the admin, query, reporting, and operations-support client.

Main scenarios:

- document list and detail pages
- document status tracking
- sales order creation and later edit/return workflows
- purchase order creation and later edit/return workflows
- finance and inventory lookup
- dashboard and reporting
- print preview, PDF download, and later management features

## Tech Stack

- React
- Ant Design Pro
- TypeScript
- `@ant-design/plots` for dashboard/reporting charts

## UI Implementation Rule

This project is an Ant Design Pro application. For page layout, dashboard density, chart presentation, card structure, table action areas, date filters, and responsive behavior, prefer the official Ant Design Pro implementation before writing custom styles.

Local official reference project:

- `/home/rgc318/python-project/ant-design-pro`

Primary references:

- `/home/rgc318/python-project/ant-design-pro/src/pages/dashboard/analysis`
- `/home/rgc318/python-project/ant-design-pro/src/pages/dashboard/workplace`
- `/home/rgc318/python-project/ant-design-pro/src/components`

Rules:

- Check the local official project before adding or redesigning a page.
- Dashboard, reporting, and analytics pages should follow the official `dashboard/analysis` structure and use official-style `Card`, `Row`, `Col`, `Tabs`, `StatisticCard`, `Table`, `Segmented`, `RangePicker`, and `@ant-design/plots` components.
- Replace official mock data with real domain services, but preserve the official information architecture, spacing, component composition, and responsive grid unless the business requirement clearly demands otherwise.
- Avoid hand-written SVG charts, arbitrary page-level styling, and custom visual systems when an official Ant Design Pro pattern already covers the use case.
- Backend integration, field mapping, permissions, and error handling must still use this project's `src/services/myapp/*` domain layer.

## Console And Dev Resource Rule

Treat console output by severity.

Must fix:

- `Unexpected token '<'` for a `.js` chunk means the browser requested a stale JavaScript chunk and received HTML, usually `index.html`, from the dev server fallback. Stop duplicate dev servers, hard refresh, and if needed clean `src/.umi`, `src/.umi-production`, `node_modules/.cache`, and `dist`.
- CSS MIME errors such as `/umi.css` returning `text/html` mean the stylesheet request received HTML. The project keeps `public/umi.css` as a dev-server compatibility stub because the Umi dev HTML can reference `/umi.css`.
- G2/G2Plot runtime errors such as `ownerDocument` or `destroyed` should be treated as chart configuration issues first. For the dashboard pie chart, keep the official-style `Pie` with `label.position = 'spider'` and avoid custom legend configuration that conflicts with the renderer lifecycle.

Should fix:

- `[React Intl] Missing message: "menu.xxx"` does not block rendering, but menu keys should be added to both `src/locales/zh-CN/menu.ts` and `src/locales/en-US/menu.ts`.
- Ant Design / ProComponents deprecation warnings should be cleaned when touching the file. Use current APIs such as `Dropdown.classNames.root`, `Space.orientation`, and `Statistic.styles.content`.

Local dev command when using the agreed fixed port:

```bash
npm run start:dev -- --port 8001
```

If chunk or `.umi/exports` issues persist:

```bash
rm -rf src/.umi src/.umi-production node_modules/.cache dist
npm run start:dev -- --port 8001
```

## Related Backend Docs

Backend docs remain the source of truth.

- API reference:
  - `/home/rgc318/python-project/frappe_docker/apps/myapp/API_GATEWAY.zh-CN.md`
- Backend overview:
  - `/home/rgc318/python-project/frappe_docker/apps/myapp/README.zh-CN.md`
- Current handoff/context:
  - `/home/rgc318/python-project/frappe_docker/apps/myapp/HANDOFF.zh-CN.md`
- Sales design:
  - `/home/rgc318/python-project/frappe_docker/apps/myapp/WHOLESALE_TECH_DESIGN.zh-CN.md`
- Purchase design:
  - `/home/rgc318/python-project/frappe_docker/apps/myapp/PURCHASE_TECH_DESIGN.zh-CN.md`

## API Usage Rule

Do not duplicate the full backend API spec in web docs.

This project should document:

- which page uses which API
- which list/detail fields the page displays
- which filters, sorting, and status values the page needs

Detailed request/response contracts should be read from the backend API document.

## First Phase Pages

- Login
- Dashboard
- Sales order list and detail
- Sales order creation
- Purchase order list, detail, and creation
- Reporting entry
- Payment list
- Finance lookup page
- Inventory ledger page
- Master-data lookup pages

## Page Requirements

### Login

- Goal:
  - authenticate the user before entering web-side admin pages
- Target user:
  - admin, finance staff, internal operator
- Key requirement:
  - keep login flow simple and aligned with the backend authentication strategy

### Dashboard

- Goal:
  - provide an Ant Design Pro-style operations dashboard backed by real reporting APIs
- Current content:
  - KPI cards
  - sales and purchase trend charts
  - customer and supplier rankings
  - receivable/payable focus table
  - sales category share chart
  - inventory value and alert summary
- Note:
  - the dashboard should continue to follow the official `dashboard/analysis` page structure rather than custom chart/layout code

### Sales Document List

- Goal:
  - display sales order, delivery, invoice, payment, and return related documents in a query-friendly way
  - support the first Web sales order creation workflow using the mobile business flow as reference
- Data source:
  - start with existing ERPNext resource/report data
- Required fields:
  - document number
  - customer
  - amount
  - outstanding amount
  - status
  - posting date
- Key actions:
  - filter by company, customer, date range, and status
  - sort by unfinished-first, newest order date, latest update time, oldest order date, and amount
  - open detail page
  - create a sales order with customer context, product selection, sales mode, UOM conversion, default pricing, and quick create
  - continue delivery and invoice detail workflows with explicit next-step guidance

Sales order status and sorting conventions:

- `completed` means fully delivered and fully invoiced/paid. Do not treat zero outstanding amount without invoices as completed.
- `cancelled` searches must pass `excludeCancelled: false`; the normal effective-order view excludes cancelled rows.
- `order_date_desc` means newest order by `transaction_date`; `latest` means latest update by `modified`.
- Translate sales fulfillment `pending` as a sales-specific label such as pending delivery, not a generic pending label.
- Sales delivery note details should guide users to the linked invoice when invoiced, to the source order with `?action=invoice` when not yet invoiced, and to historical-document guidance when cancelled.
- Sales invoice details should guide users to the source order with `?action=payment` when outstanding amount remains, to the linked delivery note when settled, and to historical-document guidance when cancelled.
- Sales invoice details and refund review should render `get_sales_invoice_detail_v2.payment.entries[]` as payment history so users can inspect split payments, write-off amounts, overpayment/unallocated amounts, and reference numbers before rolling back payment.
- Cancelling a sales invoice that has a latest payment entry should guide users through rolling back that payment before cancelling the invoice, matching the mobile workflow intent and avoiding stale settlement links.
- The sales order list uses `RemoteLinkSelect` for both company and customer filters.
- Sales order status switching should live in the status view toolbar. Summary cards are overview metrics by default; do not make them implicit filters unless the page explicitly uses a selectable-card pattern.
- Sales order status views should expose "all active orders" as the first-class default view, preferably as a card-contained `Tabs` toolbar with the risk action kept beside the tabs.
- Sales order row actions must be driven by backend `actions` flags from `search_sales_orders_v2`; do not duplicate action eligibility rules in the list page. Action links may pass `?action=delivery|invoice|payment` so the detail page can focus the matching action area.
- Sales order detail is responsible for explaining unavailable downstream actions. When entered with `?action=delivery|invoice|payment`, show a warning if the target action cannot currently run. Disabled delivery, invoice, payment, and cancel buttons should expose the reason in the detail action area; cancel reasons should use `actions.cancel_sales_order_hint` from `get_sales_order_detail` when available.
- Sales order detail pages should use an Ant Design Pro-style information architecture: `PageContainer` for document identity and actions, a dedicated financial summary card in the body, a process/progress area, a product detail table, and a right-side action/reference/info column. Keep financial values visually scannable: primary order amount is emphasized, paid amounts use success color, and outstanding amounts use danger color when greater than zero.
- Sales downstream action dialogs should be explicit workflow confirmations. Delivery and invoice dialogs should explain the default quantity basis, support partial quantities, show remaining/action quantities, and use read-only price/amount information for verification. Do not allow price editing from the delivery dialog; price changes belong to order or invoice editing flows.
- Quantity inputs for business users should not display meaningless fixed decimals. Show integers as `8`, `28`, etc.; only retain decimals when the quantity actually has a fractional part. Editable quantity fields should use the standard Ant Design `InputNumber` with direct input plus increment/decrement controls.
- Sales order edit pages should use the official `FooterToolbar` pattern for save/cancel actions and unsaved-change context. Keep the edit page split into a financial summary, order base information, and product lines. Normalize backend HTML line breaks in address/remarks text before placing them in text areas.
- Sales order risk indicators and filters must use backend `risk_filter` / `risk` fields. `delivery_overdue` means undelivered orders whose delivery date is before today; `payment_overdue` means orders with outstanding receivables whose delivery date is before today.
- Keep sales order date fields and risk indicators visually separate in tables. For example, show `deliveryDate` in the delivery date column and overdue tags in a dedicated exception/risk column.
- Sales order batch actions should use the official ProTable `rowSelection` plus `FooterToolbar` pattern. Client-side CSV export is acceptable for selected rows; full-result export should use `export_sales_orders_v2`.

Purchase order status and sorting conventions:

- `completed` means fully received and fully invoiced/paid.
- `cancelled` searches must pass `excludeCancelled: false`; the normal effective-order view excludes cancelled rows.
- `order_date_desc` means newest purchase order by `transaction_date`; `latest` means latest update by `modified`.

Company filters:

- Default company is only an initial search value. If the user clears the company field, pass an empty value so the backend searches all companies.
- Use `RemoteLinkSelect` for company fields in query forms; avoid free-text company inputs on business pages.

### Shared Components

Reusable business components should be used before adding page-local selectors or duplicated UOM logic.

- `src/components/RemoteLinkSelect.tsx`: backend-backed Frappe Link selector for Customer, Company, Warehouse, Mode of Payment, and similar fields.
  Use it for Link-like table filters instead of plain text inputs. In ProTable search forms, wire it through `formItemRender`; focus/open should load initial options and typing should refresh options through remote search.
- `src/components/ProductSelect.tsx`: product search selector returning normalized product data.
- `src/components/PaymentModeSelect.tsx`: payment mode selector for sales and purchase payment actions.
- `src/components/LineQtyEditor.tsx`: per-line quantity editor for downstream delivery, receipt, and invoice actions.
- `src/components/PartyManagementPage.tsx`: shared lightweight Customer/Supplier maintenance page with status filtering and idempotent mutations.
- `src/components/UomSelect.tsx`: UOM selector backed by `list_uoms_v2`; use it for product and order form UOM fields instead of broad Link queries.
- `src/components/WorkspacePreferenceButton.tsx`: user-level default company and warehouse preference entry.
  Default company is only an initial query value. If the user clears the company filter, requests must send no company filter and return all companies; do not fall back with `params.company ?? defaultCompany`.
- `src/utils/display-uom.ts` and `src/utils/uom-conversion.ts`: shared UOM display and stock-unit conversion helpers.
- `src/utils/sales-order-editor.ts`: sales order line model, wholesale/retail default UOM and price, UOM conversion, line amount, and total calculation.
- `src/components/PurchaseOrderLinesTable.tsx` and `src/utils/purchase-order-editor.ts`: purchase order line editing, purchase default price, UOM conversion reference, line amount, and total calculation.

### Purchase Document List

- Goal:
  - display purchase order, receipt, invoice, payment, and return related documents
- Data source:
  - start with existing ERPNext resource/report data
- Required fields:
  - document number
  - supplier
  - amount
  - outstanding amount
  - status
  - posting date
- Key actions:
  - filter by company, supplier, date range, and status
  - open detail page
  - create a purchase order with supplier context, product selection, purchase default price, UOM conversion, and quick purchase
  - edit a purchase order header and items before downstream receipt or invoice documents lock the item list
  - create a purchase invoice from a purchase receipt
  - record supplier payments from purchase invoices
  - submit purchase returns from purchase receipts or purchase invoices
  - review supplier refunds after purchase invoice returns

### Payment List

- Goal:
  - show customer and supplier payment entries in one query page
- Data source:
  - `Payment Entry`
- Required fields:
  - payment entry number
  - party type
  - party
  - payment type
  - paid amount
  - received amount
  - posting date
- Key actions:
  - filter by receive/pay, company, date range

### Inventory Ledger Page

- Goal:
  - make inbound and outbound stock changes easy to inspect
- Data source:
  - `Stock Ledger Entry`
- Required fields:
  - voucher type
  - voucher number
  - item
  - warehouse
  - actual qty
  - incoming rate
  - stock value difference
- Key actions:
  - filter by company, warehouse, item, date range

### Finance Lookup Page

- Goal:
  - give finance staff a direct place to inspect settled and unsettled documents
- Data source:
  - `Sales Invoice`
  - `Purchase Invoice`
  - `GL Entry`
  - later dashboard aggregation APIs if needed
- Required fields:
  - invoice number
  - party
  - total amount
  - outstanding amount
  - status
- Key actions:
  - switch between receivable and payable views
  - open ledger detail

## Suggested Delivery Order

Recommended web implementation order:

1. login
2. dashboard
3. sales order list and detail
4. purchase order list and detail
5. reporting entry
6. payment list
7. finance lookup page
8. inventory stock and ledger pages
9. master-data lookup pages

## Data Sources

Web can use two kinds of data sources:

- existing custom gateway APIs for business actions
- existing ERPNext resource/report data for read-only pages

Priority:

- write actions should continue to use `myapp.api.gateway.*`
- read-heavy pages can later use thin aggregation APIs if needed

## Frontend Constraints

- Web is not the primary transaction client in phase one
- Mobile is the reference for mature transaction workflows, but Web should implement desktop-friendly table/form interactions instead of copying mobile sheets directly
- Query pages should be company-aware and default to `rgc (Demo)` in the current test environment

## Run

- development:
  - `npm run dev`

Note:

- `npm run start:dev -- --port 8001` is the preferred local command when a fixed port is needed.
- The web foundation now has real JWT login, dashboard, sales order query/detail/create/edit/return/refund-review, sales delivery note and invoice list/detail, purchase order query/detail/create/edit/return/refund-review, purchase receipt and invoice list/detail, reporting entry, payment list, finance lookup, inventory stock/ledger/alerts/adjustments lookup, master-data lightweight maintenance including product image upload/replace/delete, and print preview/PDF download for core sales and purchase documents.
- Some Ant Design Pro template pages are still present and should be cleaned after the business query pages stabilize.
- For UI optimization, keep using the local official Ant Design Pro project as the baseline instead of inventing custom layouts.
