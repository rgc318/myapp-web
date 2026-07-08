import { Link } from '@umijs/max';
import React from 'react';

export function paymentEntryPath(paymentEntry: string) {
  return paymentEntry ? `/payments/${encodeURIComponent(paymentEntry)}` : '';
}

export function businessDocumentPath(doctype: string, docname: string) {
  if (!docname) {
    return '';
  }

  const encodedName = encodeURIComponent(docname);
  if (doctype === 'Delivery Note') {
    return `/sales/delivery-notes/${encodedName}`;
  }
  if (doctype === 'Sales Invoice') {
    return `/sales/invoices/${encodedName}`;
  }
  if (doctype === 'Sales Order') {
    return `/sales/orders/${encodedName}`;
  }
  if (doctype === 'Purchase Receipt') {
    return `/purchase/receipts/${encodedName}`;
  }
  if (doctype === 'Purchase Invoice') {
    return `/purchase/invoices/${encodedName}`;
  }
  if (doctype === 'Purchase Order') {
    return `/purchase/orders/${encodedName}`;
  }
  if (doctype === 'Payment Entry') {
    return paymentEntryPath(docname);
  }
  return '';
}

export function isCancelledStatus(status: string) {
  return ['cancelled', 'canceled', '已作废'].includes(status);
}

export function toPercent(
  value: number | null | undefined,
  total: number | null | undefined,
) {
  const totalValue = Number(total ?? 0);
  if (!Number.isFinite(totalValue) || totalValue <= 0) {
    return 0;
  }
  return Math.min(Math.round((Number(value ?? 0) / totalValue) * 100), 100);
}

export function DocumentLinks({
  basePath,
  emptyText = '无',
  names,
}: {
  basePath: string;
  emptyText?: React.ReactNode;
  names: string[];
}) {
  return names.length
    ? names.map((name, index) => (
        <React.Fragment key={name}>
          {index > 0 ? '、' : null}
          <Link to={`${basePath}/${encodeURIComponent(name)}`}>{name}</Link>
        </React.Fragment>
      ))
    : emptyText;
}

export function TimelineDocumentLinks<
  T extends { docname: string; doctype: string; type: string },
>({ events, type }: { events: T[]; type: T['type'] }) {
  const documents = events
    .filter((event) => event.type === type && event.docname)
    .map((event) => ({
      docname: event.docname,
      path: businessDocumentPath(event.doctype, event.docname),
    }));

  return documents.length
    ? documents.map((document, index) => (
        <React.Fragment key={`${String(type)}-${document.docname}`}>
          {index > 0 ? '、' : null}
          {document.path ? (
            <Link to={document.path}>{document.docname}</Link>
          ) : (
            document.docname
          )}
        </React.Fragment>
      ))
    : '无';
}
