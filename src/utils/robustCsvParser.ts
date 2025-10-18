// Robust CSV parser using PapaParse for header-aware parsing
// Handles various bank CSV formats with flexible header mapping

import Papa from 'papaparse';

export interface ParsedTransaction {
  date: string;           // YYYY-MM-DD
  merchant: string;       // Merchant name
  amount: number;         // Positive = expense
  bankCategory?: string;  // Original bank category (optional)
  description?: string;   // Transaction description (optional)
  raw?: Record<string, string>; // Raw parsed row for debugging
}

export interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  errors: string[];
  skipped: number;
}

// Common header name variations for each field
const DATE_HEADERS = ['Date', 'date', 'Transaction Date', 'Posted Date', 'Post Date', 'Posting Date'];
const MERCHANT_HEADERS = ['Name', 'Merchant', 'Payee', 'Description', 'Vendor'];
const AMOUNT_HEADERS = ['Amount', 'amount', 'Transaction Amount'];
const DEBIT_HEADERS = ['Debit', 'debit', 'Withdrawal'];
const CREDIT_HEADERS = ['Credit', 'credit', 'Deposit'];
const CATEGORY_HEADERS = ['Category', 'category', 'Bank Category', 'Type'];
const DESCRIPTION_HEADERS = ['Description', 'Memo', 'Notes', 'Details'];

// Skip these transaction types (internal transfers, income, etc)
const SKIP_DESCRIPTIONS = [
  'Savings Transfer',
  'Internal Transfer',
  'Loan Payment',
  'Payment Thank You',
  'ATM Withdrawal',
];

/**
 * Find the first matching header from a list of possible header names
 */
function findHeader(headers: string[], possibleNames: string[]): string | null {
  for (const name of possibleNames) {
    const found = headers.find(h => h.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }
  return null;
}

/**
 * Clean and normalize amount string (remove currency symbols, commas)
 */
function cleanAmount(value: string): number {
  const cleaned = value.replace(/[^0-9\.\-]/g, '');
  return cleaned ? parseFloat(cleaned) : 0;
}

/**
 * Normalize date to YYYY-MM-DD format
 */
function normalizeDate(dateStr: string): string | null {
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try MM/DD/YYYY format
  const mmddyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try DD/MM/YYYY format
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    // Assume MM/DD/YYYY is more common in US banks
    return `${year}-${day.padStart(2, '0')}-${month.padStart(2, '0')}`;
  }

  return null;
}

/**
 * Parse bank CSV with header-aware mapping
 * Supports multiple bank formats by detecting common header variations
 */
export function parseBankCSV(csvText: string): ParseResult {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];
  let skipped = 0;

  try {
    // Parse CSV with PapaParse
    const results = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      dynamicTyping: false, // Keep all as strings for custom parsing
    });

    // Collect PapaParse errors
    if (results.errors && results.errors.length) {
      for (const err of results.errors) {
        errors.push(`Row ${err.row ?? 'unknown'}: ${err.message}`);
      }
    }

    // Get headers
    const headers = results.meta.fields || [];
    if (headers.length === 0) {
      return {
        success: false,
        transactions: [],
        errors: ['CSV file has no headers'],
        skipped: 0,
      };
    }

    // Detect header mappings
    const dateHeader = findHeader(headers, DATE_HEADERS);
    const merchantHeader = findHeader(headers, MERCHANT_HEADERS);
    const amountHeader = findHeader(headers, AMOUNT_HEADERS);
    const debitHeader = findHeader(headers, DEBIT_HEADERS);
    const creditHeader = findHeader(headers, CREDIT_HEADERS);
    const categoryHeader = findHeader(headers, CATEGORY_HEADERS);
    const descriptionHeader = findHeader(headers, DESCRIPTION_HEADERS);

    // Validate required fields
    if (!dateHeader) {
      errors.push('Could not find Date column. Expected headers: ' + DATE_HEADERS.join(', '));
    }
    if (!merchantHeader) {
      errors.push('Could not find Merchant/Name column. Expected headers: ' + MERCHANT_HEADERS.join(', '));
    }
    if (!amountHeader && !debitHeader && !creditHeader) {
      errors.push('Could not find Amount, Debit, or Credit column');
    }

    // If missing critical headers, return early
    if (!dateHeader || !merchantHeader || (!amountHeader && !debitHeader && !creditHeader)) {
      return {
        success: false,
        transactions: [],
        errors,
        skipped: 0,
      };
    }

    // Process each row
    for (let i = 0; i < results.data.length; i++) {
      const row = results.data[i];
      const rowNum = i + 2; // +2 because header is row 1, data starts at row 2

      try {
        // Extract fields
        const dateRaw = row[dateHeader] || '';
        const merchant = row[merchantHeader] || '';
        const description = descriptionHeader ? row[descriptionHeader] || '' : '';
        const bankCategory = categoryHeader ? row[categoryHeader] || '' : '';

        // Determine amount
        let amount = 0;
        if (amountHeader) {
          amount = cleanAmount(row[amountHeader] || '');
        } else if (debitHeader && creditHeader) {
          // Debit-Credit format: debit is positive expense, credit is negative (income)
          const debit = cleanAmount(row[debitHeader] || '');
          const credit = cleanAmount(row[creditHeader] || '');
          amount = debit > 0 ? debit : -credit;
        } else if (debitHeader) {
          amount = cleanAmount(row[debitHeader] || '');
        } else if (creditHeader) {
          amount = -cleanAmount(row[creditHeader] || '');
        }

        // Skip rows with invalid data
        if (!merchant.trim()) {
          skipped++;
          continue;
        }

        // Skip internal transfers and specific descriptions
        if (SKIP_DESCRIPTIONS.some(skip => description.includes(skip) || merchant.includes(skip))) {
          skipped++;
          continue;
        }

        // Skip negative amounts (income, refunds) - we only want expenses
        if (amount <= 0) {
          skipped++;
          continue;
        }

        // Normalize date
        const date = normalizeDate(dateRaw);
        if (!date) {
          errors.push(`Row ${rowNum}: Invalid date format "${dateRaw}"`);
          continue;
        }

        // Add transaction
        transactions.push({
          date,
          merchant: merchant.trim(),
          amount,
          bankCategory: bankCategory.trim(),
          description: description.trim(),
          raw: row, // Include raw row for debugging
        });
      } catch (err) {
        errors.push(`Row ${rowNum}: ${err instanceof Error ? err.message : 'Parse error'}`);
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
      errors: [err instanceof Error ? err.message : 'Unknown parsing error'],
      skipped: 0,
    };
  }
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
  const headers = ['Date', 'Name', 'Amount', 'Category', 'Description'];
  const examples = [
    ['2025-10-09', 'KROGER 70012', '31.98', 'Groceries', 'Weekly groceries'],
    ['2025-10-08', 'CASEYS 2574', '45.50', 'Auto & Transport', 'Gas fillup'],
    ['2025-10-07', 'ALDI 70012', '28.47', 'Groceries', 'Produce and dairy'],
    ['2025-10-06', 'AMAZON MKTP', '19.99', 'Shopping', 'Household items'],
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
  a.download = 'healthhub_import_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
