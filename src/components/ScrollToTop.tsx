import React, { useState, useEffect } from 'react';
import clsx from 'clsx';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      onClick={scrollToTop}
      className={clsx(
        'fixed bottom-8 right-8 z-50 w-14 h-14 rounded-full',
        'glass-card border border-neon-blue/50',
        'flex items-center justify-center',
        'text-neon-blue hover:text-white',
        'hover:bg-neon-blue/20 hover:border-neon-blue',
        'hover:shadow-[0_0_20px_rgba(0,212,255,0.4)]',
        'transition-all duration-300',
        'backdrop-blur-md'
      )}
      title="回到顶部"
    >
      <i className="ri-arrow-up-line text-2xl" />
    </button>
  );
}
