import { useState, useEffect } from 'react';

const FONTS = [
  'font-sans font-normal',
  'font-serif font-extrabold',
  'font-mono tracking-widest',
  'font-sans italic font-thin',
  'font-serif tracking-tighter font-black',
  'font-mono font-light',
  'font-sans font-extrabold tracking-wide',
  'font-serif italic font-semibold',
  'font-mono font-bold tracking-tight',
  'font-sans tracking-widest font-medium uppercase',
  'font-serif font-extralight lowercase',
  'font-mono font-black tracking-normal',
  'font-sans font-semibold tracking-wide',
  'font-serif font-normal italic',
  'font-mono font-medium tracking-tighter',
  'font-sans font-bold',
  'font-serif font-light tracking-tight',
  'font-mono font-extrabold uppercase',
  'font-sans font-thin tracking-widest',
  'font-serif font-black lowercase',
  'font-mono font-extralight',
  'font-sans font-medium italic tracking-wide',
  'font-serif font-semibold',
  'font-mono font-normal tracking-normal',
  'font-sans font-black tracking-tighter',
  'font-serif font-bold italic',
  'font-mono font-thin tracking-widest uppercase',
  'font-sans font-extralight',
  'font-serif font-extrabold tracking-tight',
  'font-mono font-light lowercase',
  'font-sans font-semibold italic',
  'font-serif font-medium tracking-wide',
  'font-mono font-bold',
  'font-sans font-normal tracking-widest',
  'font-serif font-thin italic uppercase',
  'font-mono font-black tracking-tighter',
  'font-sans font-light',
  'font-serif font-extralight tracking-normal',
  'font-mono font-extrabold italic',
  'font-sans font-bold tracking-tight',
  'font-serif font-semibold lowercase',
  'font-mono font-medium tracking-wide',
  'font-sans font-black italic',
  'font-serif font-normal tracking-widest',
  'font-mono font-thin uppercase',
  'font-sans font-extrabold tracking-normal',
  'font-serif font-light italic',
  'font-mono font-semibold tracking-tighter',
  'font-sans font-medium tracking-wide',
  'font-serif font-bold uppercase',
];

export function AnimatedTitle() {
  const [displayText, setDisplayText] = useState('');
  const [fontIndex, setFontIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const text = 'HealtHub';

  useEffect(() => {
    const typingSpeed = isDeleting ? 50 : 100;

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing forward
        if (displayText.length < text.length) {
          setDisplayText(text.slice(0, displayText.length + 1));
        } else {
          // Finished typing, wait then start deleting
          setTimeout(() => setIsDeleting(true), 5000);
        }
      } else {
        // Deleting backward
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          // Finished deleting, change font and start typing again
          setIsDeleting(false);
          setFontIndex((fontIndex + 1) % FONTS.length);
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, fontIndex]);

  return (
    <h1 className={`text-2xl sm:text-3xl font-bold text-white drop-shadow-lg ${FONTS[fontIndex]} transition-all duration-300`}>
      {displayText}
      <span className="animate-pulse">|</span>
    </h1>
  );
}
