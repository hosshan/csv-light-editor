import React from 'react';
import { cn } from '../../lib/utils';

interface DropZoneIndicatorProps {
  type: 'row' | 'column';
  position: 'before' | 'after';
  isVisible: boolean;
  className?: string;
}

export const DropZoneIndicator: React.FC<DropZoneIndicatorProps> = ({
  type,
  position,
  isVisible,
  className,
}) => {
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'absolute z-20 bg-blue-500 transition-opacity',
        {
          'h-0.5 left-0 right-0': type === 'row',
          'w-0.5 top-0 bottom-0': type === 'column',
          'top-0': type === 'row' && position === 'before',
          'bottom-0': type === 'row' && position === 'after',
          'left-0': type === 'column' && position === 'before',
          'right-0': type === 'column' && position === 'after',
        },
        className
      )}
      style={{
        boxShadow: type === 'row' ? '0 0 4px rgba(59, 130, 246, 0.6)' : '0 0 4px rgba(59, 130, 246, 0.6)',
      }}
    >
      {/* Drop indicator arrow */}
      <div
        className={cn(
          'absolute bg-blue-500',
          {
            'w-2 h-2 transform rotate-45': true,
            '-top-1 left-2': type === 'row' && position === 'before',
            '-bottom-1 left-2': type === 'row' && position === 'after',
            '-left-1 top-2': type === 'column' && position === 'before',
            '-right-1 top-2': type === 'column' && position === 'after',
          }
        )}
      />
    </div>
  );
};