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
  const text = 'Health Hub';

  useEffect(() => {
    // Initialize random fonts for each letter
    setLetterFonts(text.split('').map(() => Math.floor(Math.random() * FONTS.length)));

    // Cycle letters (1.5x faster = 2000/1.5 = 1333ms)
    const letterInterval = setInterval(() => {
      setLetterFonts(prev => prev.map(() => Math.floor(Math.random() * FONTS.length)));
    }, 1333);

    // Cycle emoji (1.5x faster = 5000/1.5 = 3333ms)
    const emojiInterval = setInterval(() => {
      setEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
    }, 3333);

    return () => {
      clearInterval(letterInterval);
      clearInterval(emojiInterval);
    };
  }, []);

  return (
    <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg flex items-center gap-2">
      {text.split('').map((char, i) => (
        <span
          key={i}
          className={`${FONTS[letterFonts[i] || 0]} transition-all duration-200`}
        >
          {char === ' ' ? (
            <span className="text-3xl sm:text-4xl mx-1">{emoji}</span>
          ) : (
            char
          )}
        </span>
      ))}
    </h1>
  );
}
