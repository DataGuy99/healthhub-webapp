// CSV parser for bank transaction imports
// Supports the bank's 14-column format and extracts essential data

export interface ParsedTransaction {
  date: string;           // YYYY-MM-DD
  merchant: string;       // Merchant name
  amount: number;         // Positive = expense
  bankCategory: string;   // Original bank category
}

export interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  errors: string[];
  skipped: number;
}

// Category mapping from bank CSV to LifeDashHub categories
const categoryMap: Record<string, string> = {
  'Groceries': 'grocery',
  'Shopping': 'misc-shop',
  'Supplements': 'supplements',
  'Auto & Transport': 'auto',
  'Rent': 'rent',
  'Bills & Utilities': 'bills',
  'Invests': 'investment',
  'Investment': 'investment',
  'Education': 'misc-shop',
  'Software & Tech': 'misc-shop',
};

// Skip these transaction types (internal transfers, income, etc)
const skipDescriptions = [
  'Savings Transfer',
  'Internal Transfer',
  'Loan Payment',
  'Payment Thank You',
];

export function mapBankCategory(bankCategory: string): string | null {
  return categoryMap[bankCategory] || null;
}

export function parseBankCSV(csvContent: string): ParseResult {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];
  let skipped = 0;

  try {
    const lines = csvContent.trim().split('\n');

    if (lines.length === 0) {
      return {
        success: false,
        transactions: [],
        errors: ['CSV file is empty'],
        skipped: 0,
      };
    }

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const columns = parseCSVLine(line);

        if (columns.length < 11) {
          errors.push(`Line ${i + 1}: Insufficient columns (${columns.length} < 11)`);
          continue;
        }

        // Extract columns: Date(0), Name(5), Amount(7), Description(8), Category(9)
        const date = columns[0];
        const merchant = columns[5];
        const amountStr = columns[7];
        const description = columns[8];
        const category = columns[9];

        // Skip internal transfers and income
        if (skipDescriptions.some(skip => description.includes(skip))) {
          skipped++;
          continue;
        }

        // Parse amount
        const amount = parseFloat(amountStr);
        if (isNaN(amount)) {
          errors.push(`Line ${i + 1}: Invalid amount "${amountStr}"`);
          continue;
        }

        // Skip negative amounts (income, refunds, reimbursements)
        if (amount <= 0) {
          skipped++;
          continue;
        }

        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          errors.push(`Line ${i + 1}: Invalid date format "${date}"`);
          continue;
        }

        transactions.push({
          date,
          merchant: merchant.trim(),
          amount,
          bankCategory: category.trim(),
        });
      } catch (err) {
        errors.push(`Line ${i + 1}: ${err instanceof Error ? err.message : 'Parse error'}`);
      }
    }

    return {
      success: errors.length === 0,
      transactions,
      errors,
      skipped,
    };
  } catch (err) {
    return {
      success: false,
      transactions: [],
      errors: [err instanceof Error ? err.message : 'Unknown error'],
      skipped: 0,
    };
  }
}

// Parse a single CSV line, handling quoted fields with commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// Validate CSV file before parsing
export function validateCSVFile(file: File): { valid: boolean; error?: string } {
  // Check file extension
  if (!file.name.endsWith('.csv')) {
    return { valid: false, error: 'File must be a CSV (.csv)' };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  return { valid: true };
}

// Generate downloadable CSV template
export function generateCSVTemplate(): string {
  const headers = ['Date', 'Description', 'Amount', 'Category'];
  const examples = [
    ['2025-10-09', 'KROGER 70012', '31.98', 'grocery'],
    ['2025-10-08', 'CASEYS 2574', '45.50', 'auto'],
    ['2025-10-07', 'ALDI 70012', '28.47', 'grocery'],
    ['2025-10-06', 'AMAZON MKTP', '19.99', 'misc-shop'],
  ];

  const lines = [
    headers.join(','),
    ...examples.map(row => row.join(',')),
  ];

  return lines.join('\n');
}

// Download CSV template as file
export function downloadCSVTemplate(): void {
  const content = generateCSVTemplate();
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lifedash_import_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
