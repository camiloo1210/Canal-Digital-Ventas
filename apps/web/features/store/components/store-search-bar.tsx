import * as React from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { SearchIcon } from 'lucide-react';

interface StoreSearchBarProps {
  placeholder?: string;
}

export function StoreSearchBar({ placeholder }: StoreSearchBarProps): React.JSX.Element {
  return (
    <div className="relative w-full sm:max-w-md">
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <SearchInput
        placeholder={placeholder}
        paramName="q"
        resetPage
        className="w-full"
        inputClassName="h-11 pl-10"
      />
    </div>
  );
}
