'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export interface SearchInputProps {
  placeholder?: string;
  label?: string;
  inputClassName?: string;
  paramName?: string;
  debounceMs?: number;
  resetPage?: boolean;
  className?: string;
}

export function SearchInput({
  placeholder = 'Search...',
  label,
  inputClassName,
  paramName = 'q',
  debounceMs = 300,
  resetPage = true,
  className = 'flex w-full max-w-md items-center space-x-2',
}: SearchInputProps): React.JSX.Element {
  const router = useRouter();
  const t = useTranslations('Storefront');
  const inputId = React.useId();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const initialValue = searchParams.get(paramName) || '';
  const [draftValue, setDraftValue] = useState(initialValue);

  const canonicalValue = useRef(initialValue);

  useEffect(() => {
    const currentValue = searchParams.get(paramName) || '';
    if (currentValue !== canonicalValue.current) {
      canonicalValue.current = currentValue;
      setDraftValue(currentValue);
    }
  }, [searchParams, paramName]);

  useEffect(() => {
    const trimmed = draftValue.trim();
    const currentCanonical = canonicalValue.current;

    if (trimmed === currentCanonical || (trimmed === '' && currentCanonical === '')) {
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (trimmed) {
        params.set(paramName, trimmed);
      } else {
        params.delete(paramName);
      }

      if (resetPage) {
        params.delete('page');
      }

      const newQueryString = params.toString();
      const currentQueryString = searchParams.toString();

      if (newQueryString !== currentQueryString) {
        canonicalValue.current = trimmed;
        router.replace(`${pathname}?${newQueryString}`, { scroll: false });
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [draftValue, pathname, router, searchParams, paramName, debounceMs, resetPage]);

  return (
    <div className={className}>
      <Label htmlFor={inputId} className="sr-only">
        {label ?? placeholder ?? t('searchProducts')}
      </Label>
      <Input
        id={inputId}
        type="search"
        name={paramName}
        placeholder={placeholder}
        value={draftValue}
        onChange={(e) => setDraftValue(e.target.value)}
        className={cn('flex-1', inputClassName)}
      />
    </div>
  );
}
