import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase, Supplement } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

export function SupplementImportExport() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSupplements = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('supplements')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setSupplements(data || []);
    } catch (error) {
      console.error('Error loading supplements:', error);
    }
  };

  const exportToCSV = async () => {
    try {
      setLoading(true);
      await loadSupplements();

      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('supplements')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No supplements to export');
        setLoading(false);
        return;
      }

      // Create CSV content
      const headers = [
        'Name',
        'Dose',
        'Dose Unit',
        'Section',
        'Ingredients (JSON)',
        'Notes',
        'Form',
        'Frequency Pattern',
        'Active Days (JSON)',
        'Cost',
        'Quantity',
        'Frequency (days)',
      ];

      const rows = data.map((sup: Supplement) => [
        sup.name,
        sup.dose || '',
        sup.dose_unit || '',
        sup.section || '',
        sup.ingredients ? JSON.stringify(sup.ingredients) : '',
        sup.notes || '',
        sup.form || '',
        sup.frequency_pattern || '',
        sup.active_days ? JSON.stringify(sup.active_days) : '',
        sup.cost || '',
        sup.quantity || '',
        sup.frequency || '',
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','))
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `supplements_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setLoading(false);
      alert(`Exported ${data.length} supplements to CSV`);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Failed to export supplements');
      setLoading(false);
    }
  };

  const importFromCSV = async (file: File) => {
    try {
      setLoading(true);
      setImportStatus('Reading file...');

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('CSV file is empty or invalid');
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      setImportStatus(`Found ${lines.length - 1} supplements to import...`);

      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      let imported = 0;
      let skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // Parse CSV line (handle quoted values)
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            if (inQuotes && line[j + 1] === '"') {
              current += '"';
              j++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        // Validate and trim name first
        const trimmedName = (values[0] || '').trim();
        if (!trimmedName) {
          skipped++;
          continue;
        }

        const supplement: any = {
          user_id: user.id,
          name: trimmedName,
          dose: values[1] || null,
          dose_unit: values[2] || null,
          section: values[3] || null,
          notes: values[5] || null,
          form: values[6] || null,
          frequency_pattern: values[7] || 'everyday',
          is_stack: false,
          created_at: new Date().toISOString(),
        };

        // Parse JSON fields if present
        if (values[4]) {
          try {
            supplement.ingredients = JSON.parse(values[4]);
          } catch {
            supplement.ingredients = null;
          }
        }

        if (values[8]) {
          try {
            supplement.active_days = JSON.parse(values[8]);
          } catch {
            // Default to everyday
            supplement.active_days = [0, 1, 2, 3, 4, 5, 6];
          }
        } else {
          supplement.active_days = [0, 1, 2, 3, 4, 5, 6];
        }

        if (values[9]) {
          supplement.cost = parseFloat(values[9]) || null;
        }

        if (values[10]) {
          supplement.quantity = parseInt(values[10]) || null;
        }

        if (values[11]) {
          supplement.frequency = parseInt(values[11]) || null;
        }

        // Insert supplement
        const { error } = await supabase
          .from('supplements')
          .insert(supplement);

        if (error) {
          console.error(`Error importing ${supplement.name}:`, error);
          skipped++;
        } else {
          imported++;
        }

        setImportStatus(`Importing... ${imported} done, ${skipped} skipped`);
      }

      setLoading(false);
      setImportStatus('');
      alert(`Import complete!\n${imported} supplements imported\n${skipped} skipped`);
      loadSupplements();
    } catch (error) {
      console.error('Import error:', error);
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
      setImportStatus('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith('.csv')) {
      alert('Please select a valid CSV file');
      return;
    }

    // Also check MIME type for better validation
    if (file.type && !['text/csv', 'application/vnd.ms-excel', 'text/plain'].includes(file.type)) {
      alert('Invalid file type. Please select a CSV file.');
      return;
    }

    if (supplements.length > 0) {
      if (!confirm(`You have ${supplements.length} supplements. Import will add to existing data. Continue?`)) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    importFromCSV(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">📤 Import / Export</h2>
        <p className="text-white/60">Backup and restore your supplement data</p>
      </div>

      {/* Export Section */}
      <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-xl rounded-2xl border border-green-500/30 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-2">Export to CSV</h3>
            <p className="text-white/70 text-sm mb-4">
              Download all your supplements as a CSV file for backup or sharing
            </p>
            <button
              onClick={exportToCSV}
              disabled={loading}
              className="px-6 py-3 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all disabled:opacity-50"
            >
              {loading ? 'Exporting...' : '📥 Download CSV'}
            </button>
          </div>
          <div className="text-6xl">📊</div>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-xl rounded-2xl border border-blue-500/30 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-2">Import from CSV</h3>
            <p className="text-white/70 text-sm mb-4">
              Restore supplements from a CSV backup file
            </p>
            <div className="space-y-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="px-6 py-3 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 font-medium transition-all disabled:opacity-50"
              >
                {loading ? importStatus || 'Importing...' : '📤 Select CSV File'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {importStatus && (
                <div className="text-blue-300 text-sm">
                  {importStatus}
                </div>
              )}
            </div>
          </div>
          <div className="text-6xl">📁</div>
        </div>
      </div>

      {/* CSV Format Guide */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-bold text-white mb-3">CSV Format Guide</h3>
        <div className="text-white/70 text-sm space-y-2">
          <p className="font-semibold text-white">Required columns:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Name (required)</li>
            <li>Dose</li>
            <li>Dose Unit</li>
            <li>Section</li>
            <li>Ingredients (JSON) - optional</li>
            <li>Notes</li>
          </ul>
          <p className="mt-3 font-semibold text-white">Optional columns:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Form</li>
            <li>Frequency Pattern</li>
            <li>Active Days (JSON)</li>
            <li>Cost</li>
            <li>Quantity</li>
            <li>Frequency (days)</li>
          </ul>
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-300 text-xs">
              ⚠️ <strong>Important:</strong> Import adds to existing data (does not replace).
              Export before importing to backup current data.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
