import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, CategoryLog } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface ChronicleTemplateProps {
  category: string;
  categoryName: string;
  icon: string;
  color: string;
  onBack: () => void;
}

export function ChronicleTemplate({ category, categoryName, icon, color, onBack }: ChronicleTemplateProps) {
  const [events, setEvents] = useState<CategoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventAmount, setNewEventAmount] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEventType, setNewEventType] = useState<'want' | 'need'>('need');
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load events for current month
      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-31`;

      // Query category_logs directly with a pseudo-item approach
      // We'll use a special category_item_id pattern or create items on-the-fly
      const { data: eventsData, error: eventsError } = await supabase
        .from('category_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (eventsError) throw eventsError;

      // Filter to only this category's events (we'll store category in notes as JSON)
      const filteredEvents = eventsData?.filter((event: any) => {
        try {
          const metadata = JSON.parse(event.notes || '{}');
          return metadata.category === category;
        } catch {
          return false;
        }
      }) || [];

      setEvents(filteredEvents);
      setLoading(false);
    } catch (error) {
      console.error('Error loading chronicle data:', error);
      setLoading(false);
    }
  };

  const addEvent = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!newEventDescription.trim()) {
        alert('Please enter a description');
        return;
      }

      if (!newEventAmount || parseFloat(newEventAmount) <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      // Create a pseudo category_item for this event
      const { data: itemData, error: itemError } = await supabase
        .from('category_items')
        .insert({
          user_id: user.id,
          category: category,
          name: newEventDescription.trim(),
          amount: parseFloat(newEventAmount),
          frequency: 'one-time',
          is_active: false // Mark inactive since it's a one-time event
        })
        .select()
        .single();

      if (itemError) throw itemError;

      // Log the event
      const metadata = {
        category: category,
        type: newEventType,
        description: newEventDescription.trim()
      };

      const { error: logError } = await supabase
        .from('category_logs')
        .insert({
          user_id: user.id,
          category_item_id: itemData.id,
          date: newEventDate,
          actual_amount: parseFloat(newEventAmount),
          notes: JSON.stringify(metadata),
          is_planned: false,
          timestamp: new Date().toISOString()
        });

      if (logError) throw logError;

      setNewEventDescription('');
      setNewEventAmount('');
      setNewEventDate(new Date().toISOString().split('T')[0]);
      setNewEventType('need');
      setShowAddEvent(false);
      loadData();
    } catch (error) {
      console.error('Error adding event:', error);
      alert('Failed to add event');
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { error } = await supabase
        .from('category_logs')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading {categoryName}...</div>
      </div>
    );
  }

  const totalSpent = events.reduce((sum, e) => sum + (e.actual_amount || 0), 0);
  const wantSpending = events.filter(e => {
    try {
      const metadata = JSON.parse(e.notes || '{}');
      return metadata.type === 'want';
    } catch {
      return false;
    }
  }).reduce((sum, e) => sum + (e.actual_amount || 0), 0);
  const needSpending = totalSpent - wantSpending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
          >
            ← Back
          </button>
          <span className="text-4xl">{icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-white">{categoryName}</h1>
            <p className="text-white/60 text-sm">
              {events.length} event{events.length !== 1 ? 's' : ''} this month
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Navigation */}
          <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => {
                const date = new Date(currentMonth + '-01');
                date.setMonth(date.getMonth() - 1);
                setCurrentMonth(date.toISOString().slice(0, 7));
              }}
              className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-sm transition-all"
            >
              ←
            </button>
            <span className="px-3 text-white font-medium">
              {new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => {
                const date = new Date(currentMonth + '-01');
                date.setMonth(date.getMonth() + 1);
                setCurrentMonth(date.toISOString().slice(0, 7));
              }}
              className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-sm transition-all"
            >
              →
            </button>
          </div>

          <button
            onClick={() => setShowAddEvent(!showAddEvent)}
            className="px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-medium transition-all"
          >
            + Log Event
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Total Spent</h3>
          <p className="text-3xl font-bold text-white">${totalSpent.toFixed(2)}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Needs</h3>
          <p className="text-3xl font-bold text-blue-400">${needSpending.toFixed(2)}</p>
          <p className="text-xs text-white/40 mt-2">{needSpending > 0 ? Math.round((needSpending / totalSpent) * 100) : 0}% of total</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Wants</h3>
          <p className="text-3xl font-bold text-pink-400">${wantSpending.toFixed(2)}</p>
          <p className="text-xs text-white/40 mt-2">{wantSpending > 0 ? Math.round((wantSpending / totalSpent) * 100) : 0}% of total</p>
        </div>
      </div>

      {/* Add Event Form */}
      {showAddEvent && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Log New Event</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Description (e.g., New shoes, Doctor visit)"
              value={newEventDescription}
              onChange={(e) => setNewEventDescription(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 md:col-span-2"
            />
            <input
              type="number"
              placeholder="Amount"
              value={newEventAmount}
              onChange={(e) => setNewEventAmount(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <input
              type="date"
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <select
              value={newEventType}
              onChange={(e) => setNewEventType(e.target.value as 'want' | 'need')}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 md:col-span-2"
            >
              <option value="need">Need (Essential)</option>
              <option value="want">Want (Discretionary)</option>
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={addEvent}
              className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
            >
              Log Event
            </button>
            <button
              onClick={() => setShowAddEvent(false)}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Events List */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Event History</h2>

        {events.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            No events logged this month. Click "Log Event" to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              let metadata = { type: 'need', description: '' };
              try {
                metadata = JSON.parse(event.notes || '{}');
              } catch {}

              return (
                <div
                  key={event.id}
                  className="p-5 rounded-xl border bg-white/5 border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{metadata.description}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          metadata.type === 'want'
                            ? 'bg-pink-500/20 border border-pink-500/30 text-pink-300'
                            : 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                        }`}>
                          {metadata.type === 'want' ? 'Want' : 'Need'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-white/60">
                        <span>${event.actual_amount?.toFixed(2) || '0.00'}</span>
                        <span>•</span>
                        <span>{new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteEvent(event.id!)}
                      className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
