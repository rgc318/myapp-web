export function escapeCsvValue(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCsv(filename: string, rows: Array<Array<unknown>>) {
  const csvText = rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csvText}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string,
) {
  const blob = new Blob([`\uFEFF${content}`], {
    type: mimeType || 'text/plain;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
