import { useState, useEffect } from 'react';
import { supabase, BudgetSettings } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface BudgetPeriod {
  startDate: Date;
  endDate: Date;
  periodType: 'weekly' | 'biweekly' | 'monthly' | 'custom';
}

/**
 * Custom hook to manage global budget period settings
 * All budget-tracking components should use this hook to stay synchronized
 */
export function useBudgetPeriod() {
  const [settings, setSettings] = useState<BudgetSettings | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<BudgetPeriod | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('budget_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading budget settings:', error);
      }

      // Use default weekly period starting on Monday if no settings exist
      const budgetSettings: BudgetSettings = data || {
        id: '',
        user_id: user.id,
        period_type: 'weekly',
        period_start_day: 1, // Monday
        period_start_date: null,
        period_length_days: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setSettings(budgetSettings);
      setCurrentPeriod(calculateCurrentPeriod(budgetSettings));
      setLoading(false);
    } catch (error) {
      console.error('Error in useBudgetPeriod:', error);
      setLoading(false);
    }
  };

  const calculateCurrentPeriod = (budgetSettings: BudgetSettings): BudgetPeriod => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (budgetSettings.period_type) {
      case 'weekly': {
        // Find the most recent occurrence of period_start_day
        const targetDay = budgetSettings.period_start_day ?? 1; // Default Monday
        const currentDay = now.getDay();
        const daysBack = (currentDay - targetDay + 7) % 7;

        startDate = new Date(now);
        startDate.setDate(now.getDate() - daysBack);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);
        endDate.setHours(0, 0, 0, 0);
        break;
      }

      case 'biweekly': {
        // Find the most recent occurrence of period_start_day (every 2 weeks)
        const targetDay = budgetSettings.period_start_day ?? 1; // Default Monday
        const currentDay = now.getDay();
        const daysBack = (currentDay - targetDay + 7) % 7;

        startDate = new Date(now);
        startDate.setDate(now.getDate() - daysBack);
        startDate.setHours(0, 0, 0, 0);

        // Check if we need to go back another week
        const weeksSinceEpoch = Math.floor(startDate.getTime() / (7 * 24 * 60 * 60 * 1000));
        if (weeksSinceEpoch % 2 !== 0) {
          startDate.setDate(startDate.getDate() - 7);
        }

        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 14);
        endDate.setHours(0, 0, 0, 0);
        break;
      }

      case 'monthly': {
        const startDay = budgetSettings.period_start_day ?? 1;

        // If we're past the start day this month, period starts on start day this month
        // Otherwise, period started on start day last month
        if (now.getDate() >= startDay) {
          startDate = new Date(now.getFullYear(), now.getMonth(), startDay);
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, startDay);
        }
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setHours(0, 0, 0, 0);
        break;
      }

      case 'custom': {
        if (!budgetSettings.period_start_date || !budgetSettings.period_length_days) {
          // Fall back to weekly if custom settings are incomplete
          return calculateCurrentPeriod({
            ...budgetSettings,
            period_type: 'weekly',
            period_start_day: 1,
          });
        }

        const customStart = new Date(budgetSettings.period_start_date);
        const periodLength = budgetSettings.period_length_days;
        const daysSinceStart = Math.floor(
          (now.getTime() - customStart.getTime()) / (1000 * 60 * 60 * 24)
        );
        const currentPeriodNumber = Math.floor(daysSinceStart / periodLength);

        startDate = new Date(customStart);
        startDate.setDate(customStart.getDate() + currentPeriodNumber * periodLength);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + periodLength);
        endDate.setHours(0, 0, 0, 0);
        break;
      }
    }

    return {
      startDate,
      endDate,
      periodType: budgetSettings.period_type,
    };
  };

  const refreshPeriod = async () => {
    await loadSettings();
  };

  const formatPeriodDisplay = (): string => {
    if (!currentPeriod) return '';

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return `${formatDate(currentPeriod.startDate)} - ${formatDate(currentPeriod.endDate)}`;
  };

  const getDaysRemaining = (): number => {
    if (!currentPeriod) return 0;
    const now = new Date();
    const msRemaining = currentPeriod.endDate.getTime() - now.getTime();
    return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  };

  const isDateInCurrentPeriod = (date: Date): boolean => {
    if (!currentPeriod) return false;
    return date >= currentPeriod.startDate && date < currentPeriod.endDate;
  };

  return {
    settings,
    currentPeriod,
    loading,
    refreshPeriod,
    formatPeriodDisplay,
    getDaysRemaining,
    isDateInCurrentPeriod,
  };
}
