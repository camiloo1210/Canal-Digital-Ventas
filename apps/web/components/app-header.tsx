import * as React from 'react';

interface AppHeaderProps {
  children: React.ReactNode;
}

export function AppHeader({ children }: AppHeaderProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {children}
      </div>
    </header>
  );
}
