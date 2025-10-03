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
  const [activeLetterIndex, setActiveLetterIndex] = useState(0);
  const [emoji, setEmoji] = useState('💊');
  const [isSpinning, setIsSpinning] = useState(false);
  const text = 'Health Hub';

  useEffect(() => {
    // Initialize fonts for each letter (all same to start)
    setLetterFonts(text.split('').map(() => 0));

    let currentLetterIndex = 0;
    const letterCount = text.length;

    // Slightly slower cycle: 600ms
    const letterInterval = setInterval(() => {
      // Move to next letter (skip space)
      const nextIndex = (currentLetterIndex + 1) % letterCount;
      const finalNextIndex = nextIndex === 6 ? (nextIndex + 1) % letterCount : nextIndex;

      // Check if we just completed a full cycle (reached the end)
      const isLastLetter = finalNextIndex === 0 && currentLetterIndex === 9; // 'b' is index 9

      // Move underline to new letter
      setActiveLetterIndex(finalNextIndex);

      // Change the CURRENT letter's font (the one we're on before moving)
      if (currentLetterIndex !== 6) {
        setLetterFonts(prev => {
          const next = [...prev];
          const currentFont = next[currentLetterIndex];
          let newFont;

          // Ensure we pick a DIFFERENT font (not the same as current)
          do {
            newFont = Math.floor(Math.random() * FONTS.length);
          } while (newFont === currentFont);

          next[currentLetterIndex] = newFont;
          return next;
        });
      }

      // Update current index for next iteration
      currentLetterIndex = finalNextIndex;

      // When reaching the last letter and wrapping around, change the emoji
      if (isLastLetter) {
        setIsSpinning(true);
        let spinCount = 0;
        const spinInterval = setInterval(() => {
          setEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
          spinCount++;

          if (spinCount >= 15) { // More spins: 15
            clearInterval(spinInterval);
            setIsSpinning(false);
            setEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
          }
        }, 50); // Faster spin: 50ms per emoji
      }
    }, 600);

    return () => {
      clearInterval(letterInterval);
    };
  }, []);

  return (
    <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg flex items-center gap-2">
      {text.split('').map((char, i) => (
        <span key={i}>
          {char === ' ' ? (
            <span
              className={`text-3xl sm:text-4xl mx-1 inline-block transition-all duration-300 ${
                isSpinning ? 'animate-spin-fast' : ''
              }`}
            >
              {emoji}
            </span>
          ) : (
            <span className="inline-block relative">
              <span
                className={`transition-all duration-500 ${FONTS[letterFonts[i] || 0]} text-white`}
                style={{
                  transform: i === activeLetterIndex ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                }}
              >
                {char}
              </span>
              {i === activeLetterIndex && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/80 animate-underline" />
              )}
            </span>
          )}
        </span>
      ))}
      <style>{`
        @keyframes slideDown {
          0% { transform: translateY(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-spin-fast {
          animation: slideDown 0.15s ease-out;
        }
        @keyframes underline-grow {
          from { width: 0; }
          to { width: 100%; }
        }
        .animate-underline {
          animation: underline-grow 0.3s ease-out;
        }
      `}</style>
    </h1>
  );
}
