# Web Development

## Role

`myapp-web` is the admin, query, and reporting client.

Main scenarios:

- document list and detail pages
- document status tracking
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
- Dashboard placeholder
- Sales document list
- Purchase document list
- Payment list
- Inventory ledger page
- Finance lookup page

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
2. dashboard placeholder
3. sales document list
4. purchase document list
5. payment list
6. inventory ledger page
7. finance lookup page

## Data Sources

Web can use two kinds of data sources:

- existing custom gateway APIs for business actions
- existing ERPNext resource/report data for read-only pages

Priority:

- write actions should continue to use `myapp.api.gateway.*`
- read-heavy pages can later use thin aggregation APIs if needed

## Frontend Constraints

- Web is not the primary transaction client in phase one
- Do not duplicate full backend business write flows here unless mobile usage proves it is necessary
- Query pages should be company-aware and default to `rgc (Demo)` in the current test environment

## Run

- development:
  - `npm run dev`

Note:

- `npm run dev` has already been verified in the current environment.
- The current template is still the default Ant Design Pro starter and has not yet been replaced with business pages.
