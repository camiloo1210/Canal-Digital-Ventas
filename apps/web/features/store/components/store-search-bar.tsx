import * as React from 'react';
import { SearchInput } from '@/components/ui/search-input';

interface StoreSearchBarProps {
  placeholder?: string;
}

export function StoreSearchBar({ placeholder = "Search products..." }: StoreSearchBarProps): React.JSX.Element {
  return <SearchInput placeholder={placeholder} paramName="q" resetPage={true} />;
}
