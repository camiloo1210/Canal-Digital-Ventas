'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export type CatalogFieldErrors = Partial<Record<string, string[]>>;

export function useCatalogFormErrors(
  errors: CatalogFieldErrors | undefined,
  revision: number,
): { visibleErrors: CatalogFieldErrors; clearField: (name: string) => void } {
  const [cleared, setCleared] = useState<{ revision: number; fields: Set<string> }>({
    revision: -1,
    fields: new Set(),
  });
  const visibleErrors: CatalogFieldErrors = Object.fromEntries(
    Object.entries(errors ?? {}).filter(
      ([name]): boolean => cleared.revision !== revision || !cleared.fields.has(name),
    ),
  );
  const clearField = (name: string): void =>
    setCleared((previous): { revision: number; fields: Set<string> } => ({
      revision,
      fields: new Set(previous.revision === revision ? previous.fields : []).add(name),
    }));
  return { visibleErrors, clearField };
}

export function CatalogFormFeedback({
  error,
  fieldErrors,
  labels,
  revision,
  targets,
}: {
  error: string | null;
  fieldErrors: CatalogFieldErrors;
  labels: Record<string, string>;
  revision: number;
  targets?: Record<string, string>;
}): React.JSX.Element | null {
  const t = useTranslations('CatalogForms');
  const summaryRef = useRef<HTMLDivElement>(null);
  const entries = Object.entries(fieldErrors).filter(([, messages]): boolean =>
    Boolean(messages?.length),
  );
  const invalid = Boolean(error || entries.length);
  useEffect((): void => {
    if (revision > 0 && invalid) summaryRef.current?.focus();
  }, [revision, invalid]);
  if (!invalid) return null;
  return (
    <Alert
      ref={summaryRef}
      tabIndex={-1}
      role="alert"
      aria-labelledby="catalog-error-title"
      className="scroll-mt-6 border-destructive/30 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <AlertCircle aria-hidden="true" className="size-4 text-destructive" />
      <AlertTitle>
        <h2 id="catalog-error-title">{t('errorTitle')}</h2>
      </AlertTitle>
      <AlertDescription>
        {error && <p>{error}</p>}
        {entries.length > 0 && (
          <ul className="list-disc space-y-1 pl-4">
            {entries.map(([name, messages]): React.JSX.Element => (
              <li key={name}>
                <a
                  href={'#' + (targets?.[name] ?? name)}
                  className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                  onClick={(event): void => {
                    event.preventDefault();
                    document.getElementById(targets?.[name] ?? name)?.focus();
                  }}
                >
                  {labels[name] ?? name}: {messages?.[0]}
                </a>
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}
