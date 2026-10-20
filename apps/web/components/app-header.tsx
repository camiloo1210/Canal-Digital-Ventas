import * as React from 'react';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  children: React.ReactNode;
  contentClassName?: string;
}

export function AppHeader({ children, contentClassName }: AppHeaderProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div
        className={cn(
          'w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between',
          contentClassName,
        )}
      >
        {children}
      </div>
    </header>
  );
}
