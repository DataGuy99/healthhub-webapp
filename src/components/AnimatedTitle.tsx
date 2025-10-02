import { useState, useEffect } from 'react';

const FONTS = [
  'font-sans', 'font-serif', 'font-mono',
  'font-sans italic', 'font-serif italic', 'font-mono italic',
  'font-sans font-bold', 'font-serif font-bold', 'font-mono font-bold',
  'font-sans font-light', 'font-serif font-light', 'font-mono font-light',
  'font-sans font-black', 'font-serif font-black', 'font-mono font-black',
  'font-sans font-thin', 'font-serif font-thin', 'font-mono font-thin',
  'font-sans font-semibold', 'font-serif font-semibold', 'font-mono font-semibold',
];

const EMOJIS = ['💊', '🏥', '⚕️', '🩺', '💉', '🧬', '🔬', '🌡️', '💪', '🧘', '🏃', '🥗', '🍎', '🥤', '💙', '✨', '⭐', '🌟'];

export function AnimatedTitle() {
  const [letterFonts, setLetterFonts] = useState<number[]>([]);
  const [emoji, setEmoji] = useState('💊');
  const [flipping, setFlipping] = useState<number>(-1);
  const text = 'Health Hub';

  useEffect(() => {
    // Initialize random fonts for each letter
    setLetterFonts(text.split('').map(() => Math.floor(Math.random() * FONTS.length)));

    let currentLetterIndex = 0;
    const letterCount = text.length;
    const activeTimeouts: NodeJS.Timeout[] = [];

    // Cycle letters one at a time, left to right
    const letterInterval = setInterval(() => {
      // Skip the space (index 6) - only update the font for non-space characters
      if (currentLetterIndex !== 6) {
        // Occasionally do a split-flap effect (20% chance)
        const useSplitFlap = Math.random() < 0.2;

        if (useSplitFlap) {
          setFlipping(currentLetterIndex);
          const timeout = setTimeout(() => setFlipping(-1), 200);
          activeTimeouts.push(timeout);
        }

        setLetterFonts(prev => {
          const next = [...prev];
          next[currentLetterIndex] = Math.floor(Math.random() * FONTS.length);
          return next;
        });
      }

      currentLetterIndex = (currentLetterIndex + 1) % letterCount;
    }, 1333);

    // Cycle emoji (1.5x faster = 5000/1.5 = 3333ms)
    const emojiInterval = setInterval(() => {
      setEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
    }, 3333);

    return () => {
      clearInterval(letterInterval);
      clearInterval(emojiInterval);
      activeTimeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg flex items-center gap-2">
      {text.split('').map((char, i) => (
        <span
          key={i}
          className={`${FONTS[letterFonts[i] || 0]} transition-all duration-200 inline-block ${
            flipping === i ? 'animate-flip' : ''
          }`}
          style={{
            transformStyle: 'preserve-3d',
            animation: flipping === i ? 'flip 0.2s ease-in-out' : 'none',
          }}
        >
          {char === ' ' ? (
            <span className="text-3xl sm:text-4xl mx-1">{emoji}</span>
          ) : (
            char
          )}
        </span>
      ))}
      <style>{`
        @keyframes flip {
          0% { transform: rotateX(0deg); }
          50% { transform: rotateX(90deg); }
          100% { transform: rotateX(0deg); }
        }
      `}</style>
    </h1>
  );
}
