import { useState } from 'react';
import { saveHealthDataExport, HealthDataExport } from '../services/healthDataService';

export function HealthDataImporter() {
  const [jsonInput, setJsonInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  const handleImport = async () => {
    try {
      setImporting(true);
      setMessage('');

      const data: HealthDataExport = JSON.parse(jsonInput);
      await saveHealthDataExport(data);

      setMessage('✅ Data imported successfully!');
      setJsonInput('');
    } catch (error) {
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Import Health Data</h2>
      <p className="text-gray-600 mb-4">
        Paste the JSON from Netlify function logs:
      </p>

      <textarea
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder='{"time": 1759204800000, "data": {...}}'
        className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm"
        disabled={importing}
      />

      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={handleImport}
          disabled={!jsonInput.trim() || importing}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {importing ? 'Importing...' : 'Import Data'}
        </button>

        {message && (
          <span className={message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
