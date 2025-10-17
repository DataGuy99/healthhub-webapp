import { useMemo } from 'react';

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

interface AnimatedTitleProps {
  text: string;
}

export function AnimatedTitle({ text }: AnimatedTitleProps) {
  // Pick random fonts ONCE on mount - no cycling, no intervals
  const { letterFonts, emoji } = useMemo(() => {
    const fonts = text.split('').map(() => Math.floor(Math.random() * FONTS.length));
    const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    return { letterFonts: fonts, emoji: randomEmoji };
  }, [text]);

  return (
    <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg flex items-center gap-2">
      {text.split('').map((char, i) => (
        <span key={i}>
          {char === ' ' ? (
            <span className="text-3xl sm:text-4xl mx-1 inline-block">
              {emoji}
            </span>
          ) : (
            <span className={`${FONTS[letterFonts[i] || 0]} text-white`}>
              {char}
            </span>
          )}
        </span>
      ))}
    </h1>
  );
}
