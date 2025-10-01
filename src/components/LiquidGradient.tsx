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

          {/* Turbulent flow layer 1 - Concentrated veins */}
          <motion.div
            animate={{
              x: [0, 150, -100, 0],
              y: [0, -120, 80, 0],
              rotate: [0, 120, 240, 360],
            }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: [0.45, 0.05, 0.55, 0.95], // Custom easing for fluid motion
            }}
            className="absolute top-0 left-0 w-full h-full opacity-40"
            style={{
              background: `radial-gradient(ellipse 600px 400px at 20% 30%, ${currentGradient.via}80 0%, ${currentGradient.via}20 40%, transparent 70%)`,
              filter: 'blur(60px)',
            }}
          />

          {/* Turbulent flow layer 2 - Swirling veins */}
          <motion.div
            animate={{
              x: [0, -130, 90, 0],
              y: [0, 140, -70, 0],
              rotate: [360, 240, 120, 0],
            }}
            transition={{
              duration: 35,
              repeat: Infinity,
              ease: [0.45, 0.05, 0.55, 0.95],
              delay: 3,
            }}
            className="absolute bottom-0 right-0 w-full h-full opacity-50"
            style={{
              background: `radial-gradient(ellipse 500px 350px at 70% 60%, ${currentGradient.to}90 0%, ${currentGradient.to}30 35%, transparent 65%)`,
              filter: 'blur(50px)',
            }}
          />

          {/* Turbulent flow layer 3 - Dense color streaks */}
          <motion.div
            animate={{
              x: [0, 110, -80, 0],
              y: [0, -90, 110, 0],
              rotate: [0, 180, 270, 360],
              scaleX: [1, 1.3, 0.8, 1],
              scaleY: [1, 0.8, 1.2, 1],
            }}
            transition={{
              duration: 28,
              repeat: Infinity,
              ease: [0.45, 0.05, 0.55, 0.95],
              delay: 7,
            }}
            className="absolute top-1/3 left-1/2 w-96 h-96 opacity-60"
            style={{
              background: `radial-gradient(ellipse 400px 300px, ${currentGradient.from}95 0%, ${currentGradient.from}40 30%, transparent 60%)`,
              filter: 'blur(45px)',
            }}
          />

          {/* Concentrated color vein 1 - Sharp edges */}
          <motion.div
            animate={{
              x: [0, -70, 50, 0],
              y: [0, 80, -60, 0],
              rotate: [0, 90, 180, 270, 360],
              scaleX: [1, 1.5, 0.7, 1.2, 1],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: [0.65, 0, 0.35, 1],
              delay: 2,
            }}
            className="absolute top-1/4 right-1/3 w-72 h-72 opacity-70"
            style={{
              background: `linear-gradient(135deg, ${currentGradient.via} 0%, ${currentGradient.to}60 50%, transparent 100%)`,
              filter: 'blur(35px)',
              mixBlendMode: 'screen',
            }}
          />

          {/* Concentrated color vein 2 - Oil-like density */}
          <motion.div
            animate={{
              x: [0, 90, -70, 0],
              y: [0, -100, 70, 0],
              rotate: [360, 270, 180, 90, 0],
              scaleY: [1, 1.4, 0.8, 1],
            }}
            transition={{
              duration: 32,
              repeat: Infinity,
              ease: [0.65, 0, 0.35, 1],
              delay: 5,
            }}
            className="absolute bottom-1/3 left-1/4 w-80 h-80 opacity-65"
            style={{
              background: `linear-gradient(225deg, ${currentGradient.from} 0%, ${currentGradient.via}70 45%, transparent 100%)`,
              filter: 'blur(40px)',
              mixBlendMode: 'screen',
            }}
          />

          {/* Wispy smoke trails */}
          <motion.div
            animate={{
              opacity: [0.15, 0.3, 0.2, 0.15],
              x: [0, 40, -30, 0],
              y: [0, -50, 40, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 800px 600px at 40% 30%, ${currentGradient.from}25 0%, transparent 50%),
                           radial-gradient(ellipse 700px 500px at 65% 70%, ${currentGradient.to}20 0%, transparent 50%)`,
              filter: 'blur(80px)',
            }}
          />

          {/* Turbulence noise overlay for realistic fluid motion */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 800 800' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='turbulence'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='5' seed='2' stitchTiles='stitch'/%3E%3CfeDisplacementMap in='SourceGraphic' scale='50'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23turbulence)' fill='%23ffffff'/%3E%3C/svg%3E")`,
              mixBlendMode: 'overlay',
            }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
