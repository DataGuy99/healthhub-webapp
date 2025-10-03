import { useState } from 'react';
import { motion } from 'framer-motion';
import { SupplementsView } from './SupplementsView';
import { DailySupplementLogger } from './DailySupplementLogger';
import { SectionsView } from './SectionsView';
import { CostCalculator } from './CostCalculator';
import { AnimatedTitle } from './AnimatedTitle';
import { clearAuth, getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'daily' | 'supplements' | 'settings'>('daily');

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

      // Single CSV with all supplement data
      const csvHeader = 'Name,Dose,Dose Unit,Section,Ingredients (JSON),Notes\n';
      const csvRows = (supplements || []).map(s =>
        `${escapeCsvField(s.name)},${escapeCsvField(s.dose || '')},${escapeCsvField(s.dose_unit || '')},${escapeCsvField(s.section || '')},${escapeCsvField(s.ingredients ? JSON.stringify(s.ingredients) : '')},${escapeCsvField(s.notes || '')}`
      ).join('\n');
      const csv = csvHeader + csvRows;

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `supplements-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export data');
    }
  };

  const handleDownloadTemplate = () => {
    const template = `Name,Dose,Dose Unit,Section,Ingredients (JSON),Notes
Vitamin D,1000,IU,Morning,,Take with food
Omega-3,2,capsules,Morning,,
Multi-Vitamin,,,Morning,"[{""name"":""Vitamin A"",""dose"":""5000"",""dose_unit"":""IU""},{""name"":""Vitamin C"",""dose"":""500"",""dose_unit"":""mg""}]",Daily multivitamin`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supplements-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Get available sections
      const { data: sectionsData } = await supabase
        .from('supplement_sections')
        .select('*')
        .eq('user_id', user.id)
        .order('order', { ascending: true });

      const sections = sectionsData || [];

      if (sections.length === 0) {
        alert('Please create at least one section before importing supplements.');
        event.target.value = '';
        return;
      }

      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());

      const supplements = lines.slice(1).map(line => {
        const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];

        const name = values[0];
        const dose = values[1] || null;
        const dose_unit = values[2] || null;
        let section = values[3] || null;
        const ingredientsStr = values[4];
        const notes = values[5] || null;

        // Check if section exists, if not or empty, prompt user
        if (!section || !sections.find(s => s.name === section)) {
          section = null; // Will be assigned later
        }

        let ingredients = null;
        if (ingredientsStr) {
          try {
            ingredients = JSON.parse(ingredientsStr);
          } catch (e) {
            console.error('Invalid JSON for ingredients:', ingredientsStr);
          }
        }

        return {
          user_id: user.id,
          name,
          dose,
          dose_unit,
          section,
          ingredients,
          notes,
          active_days: null
        };
      }).filter(s => s.name);

      if (supplements.length === 0) {
        alert('No valid supplements found in CSV');
        event.target.value = '';
        return;
      }

      // Check if any supplements are missing sections
      const missingSection = supplements.filter(s => !s.section);

      if (missingSection.length > 0) {
        const sectionNames = sections.map(s => s.name).join(', ');
        const selectedSection = prompt(
          `${missingSection.length} supplement(s) have no section or invalid section.\n\nAvailable sections: ${sectionNames}\n\nEnter section name to assign to all of them:`,
          sections[0].name
        );

        if (!selectedSection) {
          alert('Import cancelled.');
          event.target.value = '';
          return;
        }

        // Verify selected section exists
        if (!sections.find(s => s.name === selectedSection)) {
          alert(`Section "${selectedSection}" does not exist. Import cancelled.`);
          event.target.value = '';
          return;
        }

        // Assign section to all missing
        missingSection.forEach(s => s.section = selectedSection);
      }

      const { error } = await supabase
        .from('supplements')
        .insert(supplements);

      if (error) throw error;

      alert(`Successfully imported ${supplements.length} supplements!`);
      window.location.reload();
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Failed to import supplements. Please check your CSV format.');
    }

    event.target.value = '';
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
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl font-medium transition-all duration-300 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm"
            >
              Logout
            </button>
          </div>

          {/* Mobile Bottom Navigation */}
          <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 z-50 safe-bottom">
            <div className="flex justify-around items-center h-16 px-4">
              {([
                { id: 'daily', label: 'Daily', icon: '📅' },
                { id: 'supplements', label: 'Library', icon: '💊' },
                { id: 'settings', label: 'Settings', icon: '⚙️' }
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'text-violet-400'
                      : 'text-white/60'
                  }`}
                >
                  <span className="text-2xl">{tab.icon}</span>
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </header>

        {/* Content with bottom padding for mobile nav */}
        <main className="p-4 pb-20 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'daily' && (
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

            {activeTab === 'settings' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Sections Management */}
                <div className="bg-white/10 backdrop-blur-xl p-6 rounded-2xl border border-white/20">
                  <h2 className="text-2xl font-bold text-white mb-4">⏰ Time Sections</h2>
                  <SectionsView />
                </div>

                {/* Cost Calculator */}
                <div className="bg-white/10 backdrop-blur-xl p-6 rounded-2xl border border-white/20">
                  <h2 className="text-2xl font-bold text-white mb-4">💰 Cost Calculator</h2>
                  <CostCalculator />
                </div>

                {/* Export/Import */}
                <div className="bg-white/10 backdrop-blur-xl p-6 rounded-2xl border border-white/20">
                  <h2 className="text-2xl font-bold text-white mb-4">📤 Export/Import</h2>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleExportJSON}
                        className="flex-1 min-w-[140px] px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-blue-300 font-medium transition-all"
                      >
                        📋 Export JSON
                      </button>
                      <button
                        onClick={handleExportCSV}
                        className="flex-1 min-w-[140px] px-4 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-xl text-green-300 font-medium transition-all"
                      >
                        📊 Export CSV
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex-1 min-w-[140px] px-4 py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-300 font-medium transition-all cursor-pointer text-center">
                        📥 Import CSV
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleImportCSV}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={handleDownloadTemplate}
                        className="flex-1 min-w-[140px] px-4 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-xl text-orange-300 font-medium transition-all"
                      >
                        📝 Download Template
                      </button>
                    </div>
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
