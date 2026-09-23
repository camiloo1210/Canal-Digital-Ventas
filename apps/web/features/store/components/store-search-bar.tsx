'use client';
import * as React from "react";

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface StoreSearchBarProps {
  placeholder?: string;
  buttonLabel?: string;
}

export function StoreSearchBar({ placeholder = "Search products...", buttonLabel = "Search" }: StoreSearchBarProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    const params = new URLSearchParams(searchParams.toString());
    
    if (query.trim()) {
      params.set('q', query.trim());
    } else {
      params.delete('q');
    }
    
    // Reset to page 1 on new search
    params.delete('page');

    router.push(`?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className="flex w-full max-w-md items-center space-x-2">
      <Input
        type="search"
        name="q"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1"
      />
      <Button type="submit">
        {buttonLabel}
      </Button>
    </form>
  );
}
