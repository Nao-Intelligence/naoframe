// Minimal RFC-4180 compatible CSV encoder/parser (comma delimiter, CRLF line
// breaks for output, lenient input accepting both LF and CRLF). Fields are
// quoted when they contain the delimiter, quote, or a line break.

const DELIM = ",";
const QUOTE = '"';

function quoteField(value: unknown): string {
  const s = value == null ? "" : String(value);
  const needsQuote = s.includes(DELIM) || s.includes(QUOTE) || /[\r\n]/.test(s);
  if (!needsQuote) return s;
  return `${QUOTE}${s.replace(/"/g, '""')}${QUOTE}`;
}

export function encodeCsv(header: string[], rows: Array<Record<string, unknown>>): string {
  const lines: string[] = [];
  lines.push(header.map(quoteField).join(DELIM));
  for (const row of rows) {
    lines.push(header.map((k) => quoteField(row[k])).join(DELIM));
  }
  return lines.join("\r\n") + "\r\n";
}

export function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === QUOTE) {
        if (text[i + 1] === QUOTE) {
          field += QUOTE;
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === QUOTE) {
      inQuotes = true;
    } else if (ch === DELIM) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // finalize row if the line has any content
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") records.push(row);
      row = [];
      // swallow matched \r\n
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      field += ch;
    }
  }
  // trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") records.push(row);
  }

  if (records.length === 0) return [];
  const [header, ...dataRows] = records;
  const headerKeys = header.map((h) => h.trim());
  return dataRows.map((r) => {
    const obj: Record<string, string> = {};
    headerKeys.forEach((k, idx) => {
      obj[k] = r[idx] ?? "";
    });
    return obj;
  });
}
