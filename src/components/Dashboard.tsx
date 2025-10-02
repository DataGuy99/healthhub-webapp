import { useState } from 'react';
import { motion } from 'framer-motion';
import { SupplementsView } from './SupplementsView';
import { DailySupplementLogger } from './DailySupplementLogger';
import { AnimatedTitle } from './AnimatedTitle';
import { clearAuth, getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'supplements' | 'export'>('overview');

  const handleLogout = async () => {
    await clearAuth();
    window.location.reload();
  };

  const handleExportJSON = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data: supplements } = await supabase
        .from('supplements')
        .select('*')
        .eq('user_id', user.id);

      const { data: logs } = await supabase
        .from('supplement_logs')
        .select('*')
        .eq('user_id', user.id);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        supplements: supplements || [],
        logs: logs || []
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `supplements-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Failed to export data');
    }
  };

  const escapeCsvField = (field: any): string => {
    if (field == null) return '';
    let str = String(field);
    // Prevent formula injection
    if (/^[=+\-@]/.test(str)) {
      str = "'" + str;
    }
    // Escape quotes and wrap if needed
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCSV = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data: supplements } = await supabase
        .from('supplements')
        .select('*')
        .eq('user_id', user.id);

      const { data: logs } = await supabase
        .from('supplement_logs')
        .select('*')
        .eq('user_id', user.id);

      // Create supplements CSV
      const supplementsCsvHeader = 'ID,Name,Dose,Dose Unit,Section,Created At\n';
      const supplementsCsvRows = (supplements || []).map(s =>
        `${escapeCsvField(s.id)},${escapeCsvField(s.name)},${escapeCsvField(s.dose)},${escapeCsvField(s.dose_unit)},${escapeCsvField(s.section)},${escapeCsvField(s.created_at)}`
      ).join('\n');
      const supplementsCsv = supplementsCsvHeader + supplementsCsvRows;

      // Create logs CSV
      const logsCsvHeader = 'Supplement ID,Date,Is Taken,Timestamp\n';
      const logsCsvRows = (logs || []).map(l =>
        `${escapeCsvField(l.supplement_id)},${escapeCsvField(l.date)},${escapeCsvField(l.is_taken)},${escapeCsvField(l.timestamp)}`
      ).join('\n');
      const logsCsv = logsCsvHeader + logsCsvRows;

      // Download supplements CSV
      const supplementsBlob = new Blob([supplementsCsv], { type: 'text/csv' });
      const supplementsUrl = URL.createObjectURL(supplementsBlob);
      const supplementsA = document.createElement('a');
      supplementsA.href = supplementsUrl;
      supplementsA.download = `supplements-${new Date().toISOString().split('T')[0]}.csv`;
      supplementsA.click();
      URL.revokeObjectURL(supplementsUrl);

      // Download logs CSV
      const logsBlob = new Blob([logsCsv], { type: 'text/csv' });
      const logsUrl = URL.createObjectURL(logsBlob);
      const logsA = document.createElement('a');
      logsA.href = logsUrl;
      logsA.download = `supplement-logs-${new Date().toISOString().split('T')[0]}.csv`;
      logsA.click();
      URL.revokeObjectURL(logsUrl);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export data');
    }
  };

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="p-4 sm:p-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <AnimatedTitle />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
              <nav className="flex gap-2 overflow-x-auto">
                {(['overview', 'supplements', 'export'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      px-4 sm:px-6 py-2 rounded-xl font-medium transition-all duration-300 whitespace-nowrap text-sm sm:text-base
                      ${activeTab === tab
                        ? 'bg-white/30 backdrop-blur-xl border border-white/40 text-white shadow-lg'
                        : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-white/20'
                      }
                    `}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>
              <button
                onClick={handleLogout}
                className="px-4 sm:px-6 py-2 rounded-xl font-medium transition-all duration-300 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm sm:text-base"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && (
              <DailySupplementLogger />
            )}

            {activeTab === 'supplements' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <SupplementsView />
              </motion.div>
            )}

            {activeTab === 'export' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
              >
                <h2 className="text-3xl font-bold text-white mb-6">Export Data</h2>
                <div className="space-y-4">
                  <div className="p-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-2">JSON Export</h3>
                    <p className="text-white/70 mb-4">
                      Export all supplements and logs as a single JSON file. Perfect for backups or data portability.
                    </p>
                    <button
                      onClick={handleExportJSON}
                      className="px-6 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-blue-300 font-semibold transition-all"
                    >
                      Download JSON
                    </button>
                  </div>

                  <div className="p-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-2">CSV Export</h3>
                    <p className="text-white/70 mb-4">
                      Export as CSV files (supplements + logs). Perfect for spreadsheet analysis.
                    </p>
                    <button
                      onClick={handleExportCSV}
                      className="px-6 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-xl text-green-300 font-semibold transition-all"
                    >
                      Download CSV Files
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
