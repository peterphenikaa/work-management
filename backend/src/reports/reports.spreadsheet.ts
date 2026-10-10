type Cell = string | number | null;

export function workbook(sheets: Array<{ name: string; rows: Cell[][] }>) {
  const body = sheets
    .map(
      (sheet) =>
        `<Worksheet ss:Name="${escapeXml(sheet.name)}"><Table>${sheet.rows
          .map(
            (row) =>
              `<Row>${row
                .map((cell) => {
                  if (typeof cell === 'number' && Number.isFinite(cell)) {
                    return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`;
                  }
                  return `<Cell><Data ss:Type="String">${escapeXml(cell == null ? '' : String(cell))}</Data></Cell>`;
                })
                .join('')}</Row>`,
          )
          .join('')}</Table></Worksheet>`,
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${body}</Workbook>`;
  return Buffer.from(`\uFEFF${xml}`, 'utf8');
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
