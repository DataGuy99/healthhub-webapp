import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, Reorder } from 'framer-motion';
import { db, Supplement, SupplementSection } from '../lib/db';
import { format } from 'date-fns';
import { addToSyncQueue } from '../lib/syncQueue';
import { getUserId } from '../lib/auth';

const DOSE_UNITS = ['mL', 'mcg', 'mg', 'g'] as const;
const FORMS = ['Tincture', 'Capsule', 'Powder'] as const;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SupplementsView() {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingSupplement, setEditingSupplement] = useState<Supplement | null>(null);
  const [newSectionName, setNewSectionName] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayDayIndex = new Date().getDay();

  const sections = useLiveQuery(() => db.supplementSections.orderBy('order').toArray());
  const supplements = useLiveQuery(() => db.supplements.toArray());
  const logs = useLiveQuery(() =>
    db.supplementLogs.where('date').equals(today).toArray()
  );

  const supplementsBySection = (sectionName: string) => {
    return supplements?.filter(
      s => s.section === sectionName && s.activeDays.includes(todayDayIndex)
    ).sort((a, b) => a.order - b.order) || [];
  };

  const isSupplementTaken = (suppId: number) => {
    return logs?.find(l => l.supplementId === suppId)?.isTaken || false;
  };

  const toggleSupplement = async (suppId: number) => {
    const log = logs?.find(l => l.supplementId === suppId);
    const userId = getUserId();

    if (log) {
      await db.supplementLogs.update(log.id!, { isTaken: !log.isTaken });
      if (userId) {
        await addToSyncQueue(userId, 'supplement_log', 'update', { id: log.id, isTaken: !log.isTaken });
      }
    } else {
      const newLog = {
        supplementId: suppId,
        date: today,
        isTaken: true,
        timestamp: new Date()
      };
      const id = await db.supplementLogs.add(newLog);
      if (userId) {
        await addToSyncQueue(userId, 'supplement_log', 'create', { ...newLog, id });
      }
    }
  };

  const toggleSection = async (sectionName: string) => {
    const supps = supplementsBySection(sectionName);
    const allTaken = supps.every(s => isSupplementTaken(s.id!));

    await Promise.all(supps.map(async supp => {
      const log = logs?.find(l => l.supplementId === supp.id);
      if (log) {
        await db.supplementLogs.update(log.id!, { isTaken: !allTaken });
      } else {
        await db.supplementLogs.add({
          supplementId: supp.id!,
          date: today,
          isTaken: !allTaken,
          timestamp: new Date()
        });
      }
    }));
  };

  const addSection = async () => {
    if (!newSectionName.trim()) return;
    const maxOrder = sections?.reduce((max, s) => Math.max(max, s.order), 0) || 0;
    await db.supplementSections.add({
      name: newSectionName,
      order: maxOrder + 1,
      createdAt: new Date()
    });
    setNewSectionName('');
  };

  const deleteSection = async (sectionId: number, sectionName: string) => {
    // Delete all supplements in this section
    const supps = supplements?.filter(s => s.section === sectionName) || [];
    await Promise.all(
      supps.map(async supp => {
        await db.supplements.delete(supp.id!);
        await db.supplementLogs.where('supplementId').equals(supp.id!).delete();
      })
    );
    await db.supplementSections.delete(sectionId);
  };

  const deleteSupplement = async (suppId: number) => {
    await db.supplements.delete(suppId);
    await db.supplementLogs.where('supplementId').equals(suppId).delete();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Supplements</h2>
          <p className="text-sm sm:text-base text-slate-300">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <button
          onClick={() => setIsAddingNew(true)}
          className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-slate-700/60 hover:bg-slate-600/70 backdrop-blur-sm border border-slate-600 rounded-xl text-white font-semibold transition-all duration-300"
        >
          + Add Supplement
        </button>
      </div>

      {/* Add/Edit Modal */}
      {(isAddingNew || editingSupplement) && (
        <SupplementModal
          supplement={editingSupplement}
          sections={sections || []}
          onClose={() => {
            setIsAddingNew(false);
            setEditingSupplement(null);
          }}
        />
      )}

      {/* Section Management */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 sm:p-6 shadow-2xl">
        <h3 className="text-lg sm:text-xl font-bold text-white mb-4">Manage Sections</h3>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <input
            type="text"
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-400"
            placeholder="Section name"
            onKeyDown={e => e.key === 'Enter' && addSection()}
          />
          <button
            onClick={addSection}
            className="px-4 sm:px-6 py-2 bg-slate-700/60 hover:bg-slate-600/70 border border-slate-600 rounded-xl text-white font-semibold"
          >
            Add Section
          </button>
        </div>
      </div>

      {/* Centered Dark Timeline */}
      <div className="relative max-w-4xl mx-auto">
        {/* Dark vertical timeline line */}
        <div className="absolute left-8 sm:left-12 top-0 bottom-0 w-1 bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700 shadow-lg" />

        {sections && sections.map((section, sectionIndex) => {
          const supps = supplementsBySection(section.name);
          const allTaken = supps.length > 0 && supps.every(s => isSupplementTaken(s.id!));

          return (
            <div key={section.id} className="relative pl-20 sm:pl-28 pb-8 sm:pb-12">
              {/* Timeline dot with dark theme */}
              <div className={`
                absolute left-5 sm:left-9 top-8 w-7 h-7 rounded-full border-4 transition-all shadow-xl
                ${allTaken
                  ? 'bg-green-500 border-green-400 shadow-green-500/50'
                  : 'bg-slate-700 border-slate-500 shadow-slate-900/50'}
              `} />

              <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 sm:p-6 shadow-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4">
                  <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                    <h3 className="text-xl sm:text-2xl font-bold text-white">{section.name}</h3>
                    <button
                      onClick={() => toggleSection(section.name)}
                      className={`
                        px-3 sm:px-4 py-1 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap
                        ${allTaken
                          ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                          : 'bg-slate-700/50 text-slate-200 border border-slate-600'}
                      `}
                    >
                      {allTaken ? '✓ All Taken' : 'Mark All'}
                    </button>
                  </div>
                  <button
                    onClick={() => deleteSection(section.id!, section.name)}
                    className="text-red-400 hover:text-red-300 font-semibold text-xs sm:text-sm"
                  >
                    Delete
                  </button>
                </div>

            {supps.length === 0 ? (
              <p className="text-white/50 text-center py-8">
                No supplements for today in this section
              </p>
            ) : (
              <Reorder.Group
                axis="y"
                values={supps}
                onReorder={async newOrder => {
                  // Update section and order for all items in newOrder
                  for (let i = 0; i < newOrder.length; i++) {
                    await db.supplements.update(newOrder[i].id!, {
                      section: section.name,
                      order: i
                    });
                  }
                }}
                className="space-y-2"
              >
                {supps.map(supp => {
                  const isTaken = isSupplementTaken(supp.id!);
                  return (
                    <Reorder.Item key={supp.id} value={supp}>
                      <motion.div
                        className={`
                          backdrop-blur-sm border rounded-xl p-3 sm:p-4 cursor-move
                          transition-all duration-300
                          ${isTaken
                            ? 'border-green-500/50 bg-green-900/20'
                            : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/40'}
                        `}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0 sm:justify-between">
                          <div className="flex items-center gap-3 sm:gap-4 flex-1 w-full">
                            <button
                              onClick={() => toggleSupplement(supp.id!)}
                              className={`
                                w-6 h-6 flex-shrink-0 rounded-md border-2 flex items-center justify-center
                                transition-all
                                ${isTaken
                                  ? 'bg-green-500 border-green-500'
                                  : 'border-slate-600 hover:border-slate-400 bg-slate-800'}
                              `}
                            >
                              {isTaken && <span className="text-white font-bold text-sm">✓</span>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-semibold truncate">{supp.name}</h4>
                              <p className="text-white/60 text-xs sm:text-sm truncate">
                                {supp.dose} {supp.doseUnit} · {supp.form}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => setEditingSupplement(supp)}
                              className="flex-1 sm:flex-none px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600 rounded-lg text-slate-200 text-xs sm:text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteSupplement(supp.id!)}
                              className="flex-1 sm:flex-none px-3 py-1 bg-red-900/30 hover:bg-red-800/40 border border-red-700/50 rounded-lg text-red-400 text-xs sm:text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SupplementModal({
  supplement,
  sections,
  onClose
}: {
  supplement: Supplement | null;
  sections: SupplementSection[];
  onClose: () => void;
}) {
  const [name, setName] = useState(supplement?.name || '');
  const [dose, setDose] = useState(supplement?.dose || 1);
  const [doseUnit, setDoseUnit] = useState<typeof DOSE_UNITS[number]>(supplement?.doseUnit || 'mg');
  const [form, setForm] = useState<typeof FORMS[number]>(supplement?.form || 'Capsule');
  const [section, setSection] = useState(supplement?.section || sections[0]?.name || '');
  const [activeDays, setActiveDays] = useState<number[]>(supplement?.activeDays || [0, 1, 2, 3, 4, 5, 6]);

  const toggleDay = (dayIndex: number) => {
    setActiveDays(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    // Get max order for this section
    const sectionSupps = await db.supplements.where('section').equals(section).toArray();
    const maxOrder = sectionSupps.reduce((max, s) => Math.max(max, s.order), 0);

    const data = {
      name,
      dose,
      doseUnit,
      form,
      section,
      activeDays,
      isStack: false,
      order: supplement?.order !== undefined ? supplement.order : maxOrder + 1,
      createdAt: supplement?.createdAt || new Date()
    };

    if (supplement?.id) {
      await db.supplements.update(supplement.id, data);
    } else {
      await db.supplements.add(data);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="backdrop-blur-xl bg-slate-900/95 border border-slate-700/50 rounded-2xl p-4 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">
          {supplement ? 'Edit Supplement' : 'Add Supplement'}
        </h3>

        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-slate-200 font-semibold mb-2 text-sm sm:text-base">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm sm:text-base placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-slate-200 font-semibold mb-2 text-sm sm:text-base">Dose</label>
              <input
                type="number"
                value={dose}
                onChange={e => setDose(Number(e.target.value))}
                className="w-full px-3 sm:px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm sm:text-base"
              />
            </div>
            <div>
              <label className="block text-slate-200 font-semibold mb-2 text-sm sm:text-base">Unit</label>
              <select
                value={doseUnit}
                onChange={e => setDoseUnit(e.target.value as typeof DOSE_UNITS[number])}
                className="w-full px-3 sm:px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm sm:text-base"
              >
                {DOSE_UNITS.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-200 font-semibold mb-2 text-sm sm:text-base">Form</label>
            <select
              value={form}
              onChange={e => setForm(e.target.value as typeof FORMS[number])}
              className="w-full px-3 sm:px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm sm:text-base"
            >
              {FORMS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-200 font-semibold mb-2 text-sm sm:text-base">Section</label>
            <select
              value={section}
              onChange={e => setSection(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm sm:text-base"
            >
              {sections.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-200 font-semibold mb-2 text-sm sm:text-base">Active Days</label>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {DAYS.map((day, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`
                    py-2 rounded-lg font-semibold transition-all text-xs sm:text-sm
                    ${activeDays.includes(i)
                      ? 'bg-slate-600 text-white border border-slate-500'
                      : 'bg-slate-800/50 text-slate-400 border border-slate-700'}
                  `}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8">
          <button
            onClick={handleSave}
            className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-slate-700/60 hover:bg-slate-600/70 border border-slate-600 rounded-xl text-white font-semibold text-sm sm:text-base"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700 rounded-xl text-slate-300 font-semibold text-sm sm:text-base"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
