const UTF8_BOM = "\uFEFF";
/**
 * Remove the UTF-8 Byte Order Mark (U+FEFF) if present at the start of the string.
 * Programs like Excel or Windows Notepad prepend this invisible character to CSV files.
 * If not stripped, it attaches to the first header field and breaks header validation.
 */
export function stripBOM(csv: string): string {
  return csv.startsWith(UTF8_BOM) ? csv.slice(1) : csv;
}

export function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }

  fields.push(current);
  return fields;
}
