# Web Development

Chinese implementation docs:

- `WEB_DEVELOPMENT.zh-CN.md`: JWT-only backend integration and page/API mapping
- `DEVELOPMENT_PLAN.zh-CN.md`: phased Web implementation plan

## Role

`myapp-web` is the admin, query, reporting, and operations-support client.

Main scenarios:

- document list and detail pages
- document status tracking
- sales order creation and later edit/return workflows
- purchase order creation and later edit/return workflows
- finance and inventory lookup
- dashboard and reporting
- print preview and later management features

## Tech Stack

- React
- Ant Design Pro
- TypeScript

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

### Dashboard Placeholder

- Goal:
  - provide a first landing page without blocking the rest of the web build
- First phase content:
  - sales summary placeholder
  - purchase summary placeholder
  - pending document counters
- Note:
  - detailed charts can be implemented later after core pages are stable

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
  - open detail page
  - create a sales order with customer context, product selection, sales mode, UOM conversion, default pricing, and quick create

### Shared Components

Reusable business components should be used before adding page-local selectors or duplicated UOM logic.

- `src/components/RemoteLinkSelect.tsx`: backend-backed Frappe Link selector for Customer, Company, Warehouse, Mode of Payment, and similar fields.
- `src/components/ProductSelect.tsx`: product search selector returning normalized product data.
- `src/components/PaymentModeSelect.tsx`: payment mode selector for sales and purchase payment actions.
- `src/components/LineQtyEditor.tsx`: per-line quantity editor for downstream delivery, receipt, and invoice actions.
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
  - submit purchase returns from purchase receipts or purchase invoices

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
8. inventory ledger page
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
- The web foundation now has real JWT login, dashboard, sales order query/detail/create/edit/return/refund-review, purchase order query/detail, reporting entry, payment list, finance lookup, inventory lookup, and master-data lookup pages.
- Some Ant Design Pro template pages are still present and should be cleaned after the business query pages stabilize.
