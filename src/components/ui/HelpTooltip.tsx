import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  text: string;
  className?: string;
  iconClassName?: string;
}

export function HelpTooltip({ text, className = '', iconClassName = '' }: HelpTooltipProps) {
  const tooltipId = useId();
  const iconSizeClasses = iconClassName || 'w-3.5 h-3.5';
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  useLayoutEffect(() => {
    if (!isOpen) return;
    setIsPositioned(false);

    const updatePosition = () => {
      const button = buttonRef.current;
      const tooltip = tooltipRef.current;
      if (!button || !tooltip) return;

      const rect = button.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const padding = 8;

      let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
      left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

      let top = rect.top - tooltipRect.height - padding;
      if (top < padding) {
        top = rect.bottom + padding;
      }

      setPosition({ top, left });
      setIsPositioned(true);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  return (
    <span className={`relative inline-flex items-center group ${className}`}>
      <button
        type="button"
        ref={buttonRef}
        aria-describedby={tooltipId}
        aria-label={text}
        className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      >
        <HelpCircle className={iconSizeClasses} />
      </button>
      {isOpen && typeof document !== 'undefined' && createPortal(
        <span
          id={tooltipId}
          ref={tooltipRef}
          role="tooltip"
          className="pointer-events-none fixed z-[9999] w-max max-w-xs rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{
            top: position.top,
            left: position.left,
            visibility: isPositioned ? 'visible' : 'hidden',
          }}
        >
          {text}
        </span>,
        document.body
      )}
    </span>
  );
}
