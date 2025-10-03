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
  const [activeTab, setActiveTab] = useState<'overview' | 'supplements' | 'sections' | 'costs' | 'export'>('overview');
  const [librarySubTab, setLibrarySubTab] = useState<'supplements' | 'sections'>('supplements');
  const [settingsSubTab, setSettingsSubTab] = useState<'costs' | 'export'>('costs');

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
            {/* Desktop Navigation - Hidden on mobile */}
            <div className="hidden md:flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
              <nav className="flex gap-2 overflow-x-auto">
                {(['overview', 'supplements', 'sections', 'costs', 'export'] as const).map(tab => (
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
            {/* Mobile Logout - Top right */}
            <button
              onClick={handleLogout}
              className="md:hidden absolute top-4 right-4 px-3 py-1.5 rounded-lg font-medium transition-all duration-300 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 z-50">
          <div className="flex justify-around items-center h-16 px-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 flex flex-col items-center gap-1 py-2 transition-all duration-300 ${
                activeTab === 'overview'
                  ? 'text-violet-400'
                  : 'text-white/60'
              }`}
            >
              <span className="text-2xl">📅</span>
              <span className="text-xs font-medium">Daily</span>
            </button>
            <button
              onClick={() => setActiveTab(librarySubTab)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 transition-all duration-300 ${
                activeTab === 'supplements' || activeTab === 'sections'
                  ? 'text-violet-400'
                  : 'text-white/60'
              }`}
            >
              <span className="text-2xl">💊</span>
              <span className="text-xs font-medium">Library</span>
            </button>
            <button
              onClick={() => setActiveTab(settingsSubTab)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 transition-all duration-300 ${
                activeTab === 'costs' || activeTab === 'export'
                  ? 'text-violet-400'
                  : 'text-white/60'
              }`}
            >
              <span className="text-2xl">⚙️</span>
              <span className="text-xs font-medium">Settings</span>
            </button>
          </div>
        </nav>

        {/* Content */}
        <main className="p-4 pb-24 md:pb-6 md:p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && (
              <DailySupplementLogger />
            )}

            {activeTab === 'supplements' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Mobile Sub-tabs for Library */}
                <div className="md:hidden mb-4 flex gap-2">
                  <button
                    onClick={() => {
                      setLibrarySubTab('supplements');
                      setActiveTab('supplements');
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      librarySubTab === 'supplements'
                        ? 'bg-violet-500/30 border border-violet-500/40 text-violet-300'
                        : 'bg-white/10 border border-white/20 text-white/70'
                    }`}
                  >
                    Supplements
                  </button>
                  <button
                    onClick={() => {
                      setLibrarySubTab('sections');
                      setActiveTab('sections');
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      librarySubTab === 'sections'
                        ? 'bg-violet-500/30 border border-violet-500/40 text-violet-300'
                        : 'bg-white/10 border border-white/20 text-white/70'
                    }`}
                  >
                    Sections
                  </button>
                </div>
                <SupplementsView />
              </motion.div>
            )}

            {activeTab === 'sections' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Mobile Sub-tabs for Library */}
                <div className="md:hidden mb-4 flex gap-2">
                  <button
                    onClick={() => {
                      setLibrarySubTab('supplements');
                      setActiveTab('supplements');
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      librarySubTab === 'supplements'
                        ? 'bg-violet-500/30 border border-violet-500/40 text-violet-300'
                        : 'bg-white/10 border border-white/20 text-white/70'
                    }`}
                  >
                    Supplements
                  </button>
                  <button
                    onClick={() => {
                      setLibrarySubTab('sections');
                      setActiveTab('sections');
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      librarySubTab === 'sections'
                        ? 'bg-violet-500/30 border border-violet-500/40 text-violet-300'
                        : 'bg-white/10 border border-white/20 text-white/70'
                    }`}
                  >
                    Sections
                  </button>
                </div>
                <SectionsView />
              </motion.div>
            )}

            {activeTab === 'costs' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Mobile Sub-tabs for Settings */}
                <div className="md:hidden mb-4 flex gap-2">
                  <button
                    onClick={() => {
                      setSettingsSubTab('costs');
                      setActiveTab('costs');
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      settingsSubTab === 'costs'
                        ? 'bg-violet-500/30 border border-violet-500/40 text-violet-300'
                        : 'bg-white/10 border border-white/20 text-white/70'
                    }`}
                  >
                    Costs
                  </button>
                  <button
                    onClick={() => {
                      setSettingsSubTab('export');
                      setActiveTab('export');
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      settingsSubTab === 'export'
                        ? 'bg-violet-500/30 border border-violet-500/40 text-violet-300'
                        : 'bg-white/10 border border-white/20 text-white/70'
                    }`}
                  >
                    Export
                  </button>
                </div>
                <CostCalculator />
              </motion.div>
            )}

            {activeTab === 'export' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
              >
                {/* Mobile Sub-tabs for Settings */}
                <div className="md:hidden mb-4 flex gap-2">
                  <button
                    onClick={() => {
                      setSettingsSubTab('costs');
                      setActiveTab('costs');
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      settingsSubTab === 'costs'
                        ? 'bg-violet-500/30 border border-violet-500/40 text-violet-300'
                        : 'bg-white/10 border border-white/20 text-white/70'
                    }`}
                  >
                    Costs
                  </button>
                  <button
                    onClick={() => {
                      setSettingsSubTab('export');
                      setActiveTab('export');
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      settingsSubTab === 'export'
                        ? 'bg-violet-500/30 border border-violet-500/40 text-violet-300'
                        : 'bg-white/10 border border-white/20 text-white/70'
                    }`}
                  >
                    Export
                  </button>
                </div>
                <h2 className="text-3xl font-bold text-white mb-6">Import / Export</h2>
                <div className="space-y-4">
                  <div className="p-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-2">Import Supplements (CSV)</h3>
                    <p className="text-white/70 mb-4">
                      Upload a CSV file to bulk-import supplements. Not sure about the format? Download the template below.
                    </p>
                    <div className="flex gap-2">
                      <label className="px-6 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-300 font-semibold transition-all cursor-pointer">
                        Upload CSV
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleImportCSV}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={handleDownloadTemplate}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-all"
                      >
                        Download Template
                      </button>
                    </div>
                  </div>

                  <div className="p-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-2">CSV Export</h3>
                    <p className="text-white/70 mb-4">
                      Export supplements as a single CSV file. Perfect for spreadsheet analysis.
                    </p>
                    <button
                      onClick={handleExportCSV}
                      className="px-6 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-xl text-green-300 font-semibold transition-all"
                    >
                      Download CSV
                    </button>
                  </div>

                  <div className="p-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-2">JSON Export</h3>
                    <p className="text-white/70 mb-4">
                      Export all supplements and logs as JSON. Perfect for backups or data portability.
                    </p>
                    <button
                      onClick={handleExportJSON}
                      className="px-6 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-blue-300 font-semibold transition-all"
                    >
                      Download JSON
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
