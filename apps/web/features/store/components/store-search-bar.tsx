'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

interface StoreSearchBarProps {
  placeholder?: string;
}

export function StoreSearchBar({ placeholder = "Search products..." }: StoreSearchBarProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const initialQ = searchParams.get('q') || '';
  const [draftQuery, setDraftQuery] = useState(initialQ);
  
  // Track current URL state to prevent unnecessary navigations
  const canonicalQ = useRef(initialQ);

  // Sync draftQuery if URL changes externally (e.g. Back/Forward navigation)
  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== canonicalQ.current) {
      canonicalQ.current = q;
      setDraftQuery(q);
    }
  }, [searchParams]);

  useEffect(() => {
    // Only debounce if the local draft differs from the canonical URL
    const trimmed = draftQuery.trim();
    const currentQ = canonicalQ.current;
    
    // If there's no difference after trimming, do nothing
    if (trimmed === currentQ || (trimmed === '' && currentQ === '')) {
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      
      if (trimmed) {
        params.set('q', trimmed);
      } else {
        params.delete('q');
      }
      
      params.delete('page');
      
      const newQueryString = params.toString();
      const currentQueryString = searchParams.toString();
      
      if (newQueryString !== currentQueryString) {
        canonicalQ.current = trimmed;
        router.replace(`${pathname}?${newQueryString}`, { scroll: false });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [draftQuery, pathname, router, searchParams]);

  return (
    <div className="flex w-full max-w-md items-center space-x-2">
      <Input
        type="search"
        name="q"
        placeholder={placeholder}
        value={draftQuery}
        onChange={(e) => setDraftQuery(e.target.value)}
        className="flex-1"
      />
    </div>
  );
}
