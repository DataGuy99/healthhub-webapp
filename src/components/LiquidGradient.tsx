import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GradientColors {
  from: string;
  via: string;
  to: string;
  name: string;
}

const getTimeBasedGradient = (hour: number): GradientColors => {
  if (hour >= 5 && hour < 12) {
    // Morning: Teal → Yellow
    return {
      from: '#14B8A6', // teal-500
      via: '#2DD4BF',  // teal-400
      to: '#FCD34D',   // yellow-300
      name: 'morning'
    };
  } else if (hour >= 12 && hour < 17) {
    // Afternoon: Orange → Ruby
    return {
      from: '#FB923C', // orange-400
      via: '#F97316',  // orange-500
      to: '#BE123C',   // rose-700
      name: 'afternoon'
    };
  } else if (hour >= 17 && hour < 21) {
    // Evening: Pink → Peach
    return {
      from: '#F472B6', // pink-400
      via: '#FB7185',  // rose-400
      to: '#FDBA74',   // orange-300
      name: 'evening'
    };
  } else {
    // Night: Amethyst → Navy
    return {
      from: '#A78BFA', // violet-400
      via: '#818CF8',  // indigo-400
      to: '#1E3A8A',   // blue-900
      name: 'night'
    };
  }
};

export function LiquidGradientBackground() {
  const [currentGradient, setCurrentGradient] = useState<GradientColors>(() => {
    const hour = new Date().getHours();
    return getTimeBasedGradient(hour);
  });

  useEffect(() => {
    // Update gradient every minute to catch time transitions
    const interval = setInterval(() => {
      const hour = new Date().getHours();
      const newGradient = getTimeBasedGradient(hour);

      if (newGradient.name !== currentGradient.name) {
        setCurrentGradient(newGradient);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [currentGradient.name]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentGradient.name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 3, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {/* Main gradient background */}
          <div
            className="absolute inset-0 bg-gradient-to-br animate-gradient"
            style={{
              backgroundImage: `linear-gradient(135deg, ${currentGradient.from} 0%, ${currentGradient.via} 50%, ${currentGradient.to} 100%)`,
              backgroundSize: '200% 200%'
            }}
          />

          {/* Animated blob 1 - Large swirl */}
          <motion.div
            animate={{
              x: [0, 100, -50, 0],
              y: [0, -100, 50, 0],
              scale: [1, 1.2, 0.8, 1],
              rotate: [0, 90, 180, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-30 blur-3xl"
            style={{
              background: `radial-gradient(circle, ${currentGradient.via} 0%, transparent 70%)`
            }}
          />

          {/* Animated blob 2 - Medium swirl */}
          <motion.div
            animate={{
              x: [0, -80, 60, 0],
              y: [0, 120, -80, 0],
              scale: [1, 0.8, 1.3, 1],
              rotate: [360, 270, 90, 0],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 2,
            }}
            className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-40 blur-3xl"
            style={{
              background: `radial-gradient(circle, ${currentGradient.to} 0%, transparent 70%)`
            }}
          />

          {/* Animated blob 3 - Small accent */}
          <motion.div
            animate={{
              x: [0, 60, -40, 0],
              y: [0, -60, 80, 0],
              scale: [1, 1.1, 0.9, 1],
              rotate: [0, 180, 270, 360],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 5,
            }}
            className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full opacity-25 blur-3xl"
            style={{
              background: `radial-gradient(circle, ${currentGradient.from} 0%, transparent 70%)`
            }}
          />

          {/* Smoke/mist effect overlay */}
          <motion.div
            animate={{
              opacity: [0.1, 0.2, 0.15, 0.1],
              scale: [1, 1.1, 1.05, 1],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 30% 50%, ${currentGradient.from}15 0%, transparent 50%),
                           radial-gradient(circle at 70% 80%, ${currentGradient.to}10 0%, transparent 50%)`
            }}
          />

          {/* Subtle noise texture overlay for depth */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
