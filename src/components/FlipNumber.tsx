import { useState, useEffect } from 'react';
import clsx from 'clsx';

interface FlipNumberProps {
  value: number;
  decimals?: number;
  className?: string;
}

/**
 * 数字翻牌组件
 * 当数值变化时，会有翻牌动画效果
 */
export function FlipNumber({ value, decimals = 2, className }: FlipNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isFlipping, setIsFlipping] = useState(false);
  const [direction, setDirection] = useState<'up' | 'down'>('up');

  useEffect(() => {
    if (value !== displayValue) {
      setDirection(value > displayValue ? 'up' : 'down');
      setIsFlipping(true);
      setTimeout(() => {
        setDisplayValue(value);
        setIsFlipping(false);
      }, 150);
    }
  }, [value, displayValue]);

  return (
    <span
      className={clsx(
        'inline-block tabular-nums font-mono',
        isFlipping && (direction === 'up' ? 'number-flip-up' : 'number-flip-down'),
        className
      )}
    >
      {displayValue.toFixed(decimals)}
    </span>
  );
}
