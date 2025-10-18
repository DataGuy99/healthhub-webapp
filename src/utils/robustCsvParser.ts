import Papa from 'papaparse';

export interface ParsedTransaction {
  date: string;
  merchant: string;
  amount: number;
  bankCategory?: string;
  description?: string;
  raw?: Record<string, string>;
}

/**
 * parseBankCSV
 * - Uses PapaParse to handle RFC-compliant CSV parsing (quotes, commas, newlines in fields)
 * - Tries multiple common header names for date/merchant/amount/category/description
 * - Returns transactions[] and errors[] (parsing warnings/errors)
 */
export function parseBankCSV(csvText: string): { transactions: ParsedTransaction[]; errors: string[] } {
  const results = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => (h || '').trim(),
  });

  const errors: string[] = [];
  if (results.errors && results.errors.length) {
    for (const e of results.errors) {
      // PapaParse error: { type, code, message, row }
      errors.push(`Row ${e.row ?? '?'}: ${e.message ?? e.code ?? 'Parse error'}`);
    }
  }

  const transactions: ParsedTransaction[] = [];

  for (const row of results.data) {
    // tolerant header mapping
    const date =
      row['Date'] ||
      row['date'] ||
      row['Transaction Date'] ||
      row['Posted Date'] ||
      row['posted_date'] ||
      '';

    const merchant =
      row['Name'] ||
      row['Merchant'] ||
      row['Payee'] ||
      row['Description'] ||
      row['name'] ||
      '';

    // common amount headers
    const amountRaw =
      (row['Amount'] ||
        row['amount'] ||
        row['Debit'] ||
        row['Credit'] ||
        row['Transaction Amount'] ||
        '') + '';

    const bankCategory =
      row['Category'] || row['category'] || row['Bank Category'] || row['Type'] || '';

    const description = row['Description'] || row['Memo'] || row['Notes'] || '';

    // Normalize amount: strip currency symbols and thousands separators
    const cleaned = amountRaw.replace(/[^0-9.\-]/g, '');
    const amount = cleaned ? parseFloat(cleaned) : 0;

    transactions.push({
      date: date.trim(),
      merchant: merchant.trim(),
      amount,
      bankCategory: bankCategory ? bankCategory.trim() : undefined,
      description: description ? description.trim() : undefined,
      raw: row,
    });
  }

  return { transactions, errors };
}
