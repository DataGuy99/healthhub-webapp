import { useState, useEffect } from 'react';

const FONTS = [
  'font-sans',
  'font-serif',
  'font-mono',
  'font-bold',
  'italic',
  'tracking-widest',
  'tracking-tighter',
];

export function AnimatedTitle() {
  const [displayText, setDisplayText] = useState('');
  const [fontIndex, setFontIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const text = 'HealthHub';

  useEffect(() => {
    const typingSpeed = isDeleting ? 50 : 100;

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing forward
        if (displayText.length < text.length) {
          setDisplayText(text.slice(0, displayText.length + 1));
        } else {
          // Finished typing, wait then start deleting
          setTimeout(() => setIsDeleting(true), 2000);
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
