import { describe, it, expect } from 'vitest';
import { parseBankCSV, validateCSVFile } from '../../src/utils/robustCsvParser';

// Sample CSV fixtures as strings
const tvaCsvSample = `Date,Original Date,Account Type,Account Name,Account Number,Institution Name,Name,Custom Name,Amount,Description,Category,Note,Ignored From,Tax Deductible
2025-10-09,2025-10-09,Cash,Best Checking Pkg,7480,KTVA,ALDI 70012,,31.98,Card Purchase ALDI 70012,Groceries,,,
2025-10-08,2025-10-08,Cash,Best Checking Pkg,7480,KTVA,CASEYS 2574,,45.50,Card Purchase CASEYS,Auto & Transport,,,
2025-10-07,2025-10-07,Cash,Best Checking Pkg,7480,KTVA,KROGER 8901,,28.47,Card Purchase KROGER,Groceries,,,
2025-10-06,2025-10-06,Cash,Best Checking Pkg,7480,KTVA,AMAZON MKTP,,19.99,Card Purchase AMAZON,Shopping,,,
2025-10-05,2025-10-05,Cash,Best Checking Pkg,7480,KTVA,KUB PAYMENT,,125.00,Bill Payment KUB,Bills & Utilities,,,
2025-10-04,2025-10-04,Cash,Best Checking Pkg,7480,KTVA,SAMSCLUB 6234,,85.33,Card Purchase SAMSCLUB,Groceries,,,
2025-10-03,2025-10-03,Cash,Best Checking Pkg,7480,KTVA,Savings Transfer,,-500.00,Internal Transfer,Transfer,,,
2025-10-02,2025-10-02,Cash,Best Checking Pkg,7480,KTVA,Paycheck Deposit,,-1850.00,Direct Deposit,Income,,,`;

const chaseCsvSample = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
10/09/2025,10/09/2025,WHOLE FOODS MKT,Groceries,Sale,42.15,
10/08/2025,10/08/2025,SHELL OIL,Gas,Sale,52.30,
10/07/2025,10/07/2025,STARBUCKS,Dining,Sale,8.75,
10/06/2025,10/06/2025,WALGREENS,Health & Wellness,Sale,24.99,
10/05/2025,10/05/2025,NETFLIX.COM,Entertainment,Sale,15.99,
10/04/2025,10/04/2025,TARGET,Shopping,Sale,67.82,
10/03/2025,10/03/2025,PAYMENT - THANK YOU,Payment,Payment,-450.00,`;

const debitCreditCsvSample = `Date,Merchant,Debit,Credit,Category,Notes
2025-10-09,WALMART SUPERCENTER,95.43,,Groceries,Weekly shopping
2025-10-08,EXXON MOBIL,48.20,,Auto & Transport,Gas fillup
2025-10-07,CVS PHARMACY,18.50,,Health & Wellness,Prescriptions
2025-10-06,DIRECT DEPOSIT,,2500.00,Income,Paycheck
2025-10-05,COMCAST,89.99,,Bills & Utilities,Internet
2025-10-04,PUBLIX,55.67,,Groceries,Groceries
2025-10-03,ATM WITHDRAWAL,100.00,,Cash,ATM cash`;

describe('robustCsvParser', () => {
  describe('parseBankCSV', () => {
    it('should parse TVA ECU format correctly', () => {
      const result = parseBankCSV(tvaCsvSample);

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(6); // 8 rows - 2 skipped (transfer, income)
      expect(result.skipped).toBe(2);

      // Check first transaction
      const first = result.transactions[0];
      expect(first.date).toBe('2025-10-09');
      expect(first.merchant).toBe('ALDI 70012');
      expect(first.amount).toBe(31.98);
      expect(first.bankCategory).toBe('Groceries');
      expect(first.raw).toBeDefined();
    });

    it('should parse Chase format with MM/DD/YYYY dates', () => {
      const result = parseBankCSV(chaseCsvSample);

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(6); // 7 rows - 1 skipped (payment)
      expect(result.skipped).toBe(1);

      // Check first transaction with date normalization
      const first = result.transactions[0];
      expect(first.date).toBe('2025-10-09');
      expect(first.merchant).toBe('WHOLE FOODS MKT');
      expect(first.amount).toBe(42.15);
    });

    it('should handle Debit/Credit column format', () => {
      const result = parseBankCSV(debitCreditCsvSample);

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(6); // 7 rows - 1 skipped (income)
      expect(result.skipped).toBe(1); // Only income skipped, ATM is positive expense

      // Check debit transaction
      const first = result.transactions[0];
      expect(first.merchant).toBe('WALMART SUPERCENTER');
      expect(first.amount).toBe(95.43);
    });

    it('should handle quoted fields with commas', () => {
      const csv = `Date,Name,Amount,Category
2025-10-09,"ACME Corp, Inc.",100.50,Shopping
2025-10-08,Simple Merchant,50.25,Groceries`;

      const result = parseBankCSV(csv);

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].merchant).toBe('ACME Corp, Inc.');
      expect(result.transactions[0].amount).toBe(100.50);
    });

    it('should clean amount strings with currency symbols', () => {
      const csv = `Date,Merchant,Amount
2025-10-09,Test Store,1234.56
2025-10-08,Another Store,99.99`;

      const result = parseBankCSV(csv);

      expect(result.success).toBe(true);
      expect(result.transactions[0].amount).toBe(1234.56);
      expect(result.transactions[1].amount).toBe(99.99);
    });

    it('should skip negative amounts (income/refunds)', () => {
      const csv = `Date,Name,Amount
2025-10-09,Store Purchase,50.00
2025-10-08,Refund,-25.00
2025-10-07,Paycheck,-1500.00
2025-10-06,Another Purchase,30.00`;

      const result = parseBankCSV(csv);

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(2);
      expect(result.skipped).toBe(2);
      expect(result.transactions[0].amount).toBe(50.00);
      expect(result.transactions[1].amount).toBe(30.00);
    });

    it('should skip internal transfers and specific descriptions', () => {
      const csv = `Date,Name,Description,Amount
2025-10-09,Valid Store,,50.00
2025-10-08,Transfer,Savings Transfer,100.00
2025-10-07,Valid Store 2,,30.00
2025-10-06,Loan,Loan Payment,200.00
2025-10-05,Valid Store 3,,25.00`;

      const result = parseBankCSV(csv);

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(3);
      expect(result.skipped).toBe(2);
    });

    it('should include raw row data for debugging', () => {
      const csv = `Date,Name,Amount,Category,Extra Column
2025-10-09,Test Store,50.00,Shopping,Extra Data`;

      const result = parseBankCSV(csv);

      expect(result.success).toBe(true);
      expect(result.transactions[0].raw).toBeDefined();
      expect(result.transactions[0].raw?.['Extra Column']).toBe('Extra Data');
    });

    it('should handle empty CSV', () => {
      const result = parseBankCSV('');

      expect(result.success).toBe(false);
      expect(result.transactions).toHaveLength(0);
      expect(result.errors).toContain('CSV file has no headers');
    });

    it('should handle missing required headers', () => {
      const csv = `WrongHeader1,WrongHeader2,WrongHeader3
value1,value2,value3`;

      const result = parseBankCSV(csv);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Date'))).toBe(true);
    });

    it('should report invalid date formats', () => {
      const csv = `Date,Name,Amount
invalid-date,Store,50.00`;

      const result = parseBankCSV(csv);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid date'))).toBe(true);
    });

    it('should skip rows with empty merchant names', () => {
      const csv = `Date,Name,Amount
2025-10-09,,50.00
2025-10-08,Valid Store,30.00`;

      const result = parseBankCSV(csv);

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(1);
      expect(result.skipped).toBe(1);
    });

    it('should handle various date formats', () => {
      const csv = `Date,Merchant,Amount
2025-10-09,Store1,10.00
10/08/2025,Store2,20.00
2025-10-07,Store3,30.00`;

      const result = parseBankCSV(csv);

      expect(result.success).toBe(true);
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0].date).toBe('2025-10-09');
      expect(result.transactions[1].date).toBe('2025-10-08');
      expect(result.transactions[2].date).toBe('2025-10-07');
    });
  });

  describe('validateCSVFile', () => {
    it('should accept valid CSV files', () => {
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject non-CSV files', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = validateCSVFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File must be a CSV (.csv)');
    });

    it('should reject files larger than 10MB', () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const file = new File([largeContent], 'large.csv', { type: 'text/csv' });
      const result = validateCSVFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File size must be less than 10MB');
    });
  });
});
