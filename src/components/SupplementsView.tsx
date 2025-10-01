import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, Reorder } from 'framer-motion';
import { db, Supplement, SupplementSection } from '../lib/db';
import { format } from 'date-fns';

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
    if (log) {
      await db.supplementLogs.update(log.id!, { isTaken: !log.isTaken });
    } else {
      await db.supplementLogs.add({
        supplementId: suppId,
        date: today,
        isTaken: true,
        timestamp: new Date()
      });
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
    // Move supplements to "Unsorted"
    const supps = supplements?.filter(s => s.section === sectionName) || [];
    await Promise.all(
      supps.map(supp => db.supplements.update(supp.id!, { section: 'Unsorted' }))
    );
    await db.supplementSections.delete(sectionId);
  };

  const deleteSupplement = async (suppId: number) => {
    await db.supplements.delete(suppId);
    await db.supplementLogs.where('supplementId').equals(suppId).delete();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Supplements</h2>
          <p className="text-white/70">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <button
          onClick={() => setIsAddingNew(true)}
          className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-xl text-white font-semibold transition-all duration-300"
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
      <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Manage Sections</h3>
        <div className="flex gap-4">
          <input
            type="text"
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
            onKeyDown={e => e.key === 'Enter' && addSection()}
          />
          <button
            onClick={addSection}
            className="px-6 py-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white font-semibold"
          >
            Add Section
          </button>
        </div>
      </div>

      {/* Supplement Sections */}
      {sections && sections.map(section => {
        const supps = supplementsBySection(section.name);
        const allTaken = supps.length > 0 && supps.every(s => isSupplementTaken(s.id!));

        return (
          <div
            key={section.id}
            className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-bold text-white">{section.name}</h3>
                <button
                  onClick={() => toggleSection(section.name)}
                  className={`
                    px-4 py-1 rounded-lg text-sm font-semibold transition-all
                    ${allTaken
                      ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                      : 'bg-white/20 text-white border border-white/30'}
                  `}
                >
                  {allTaken ? '✓ All Taken' : 'Mark All'}
                </button>
              </div>
              <button
                onClick={() => deleteSection(section.id!, section.name)}
                className="text-red-300 hover:text-red-200 font-semibold"
              >
                Delete Section
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
                          backdrop-blur-sm bg-white/5 border rounded-xl p-4 cursor-move
                          transition-all duration-300
                          ${isTaken
                            ? 'border-green-500/50 bg-green-500/10'
                            : 'border-white/20 hover:bg-white/10'}
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <button
                              onClick={() => toggleSupplement(supp.id!)}
                              className={`
                                w-6 h-6 rounded-md border-2 flex items-center justify-center
                                transition-all
                                ${isTaken
                                  ? 'bg-green-500 border-green-500'
                                  : 'border-white/40 hover:border-white/60'}
                              `}
                            >
                              {isTaken && <span className="text-white font-bold">✓</span>}
                            </button>
                            <div className="flex-1">
                              <h4 className="text-white font-semibold">{supp.name}</h4>
                              <p className="text-white/60 text-sm">
                                {supp.dose} {supp.doseUnit} · {supp.form}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingSupplement(supp)}
                              className="px-3 py-1 bg-white/20 hover:bg-white/30 border border-white/30 rounded-lg text-white text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteSupplement(supp.id!)}
                              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 text-sm"
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
        );
      })}
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
  const [section, setSection] = useState(supplement?.section || sections[0]?.name || 'Unsorted');
  const [activeDays, setActiveDays] = useState<number[]>(supplement?.activeDays || [0, 1, 2, 3, 4, 5, 6]);

  // Initialize Unsorted section if it doesn't exist
  useEffect(() => {
    const initializeUnsorted = async () => {
      const unsorted = await db.supplementSections.where('name').equals('Unsorted').first();
      if (!unsorted) {
        await db.supplementSections.add({
          name: 'Unsorted',
          order: 0,
          createdAt: new Date()
        });
      }
    };
    initializeUnsorted();
  }, []);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-2xl font-bold text-white mb-6">
          {supplement ? 'Edit Supplement' : 'Add Supplement'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-white font-semibold mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white font-semibold mb-2">Dose</label>
              <input
                type="number"
                value={dose}
                onChange={e => setDose(Number(e.target.value))}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-white font-semibold mb-2">Unit</label>
              <select
                value={doseUnit}
                onChange={e => setDoseUnit(e.target.value as typeof DOSE_UNITS[number])}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
              >
                {DOSE_UNITS.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-white font-semibold mb-2">Form</label>
            <select
              value={form}
              onChange={e => setForm(e.target.value as typeof FORMS[number])}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
            >
              {FORMS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-white font-semibold mb-2">Section</label>
            <select
              value={section}
              onChange={e => setSection(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
            >
              {sections.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-white font-semibold mb-2">Active Days</label>
            <div className="flex gap-2">
              {DAYS.map((day, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`
                    flex-1 py-2 rounded-lg font-semibold transition-all
                    ${activeDays.includes(i)
                      ? 'bg-white/30 text-white border border-white/40'
                      : 'bg-white/10 text-white/50 border border-white/20'}
                  `}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white font-semibold"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white/70 font-semibold"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
