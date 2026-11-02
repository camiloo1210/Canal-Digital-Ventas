'use client';

import * as React from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PublicStoreLink({ url }: { url: string }): React.JSX.Element {
  const t = useTranslations('StoreSettings');
  const [copied, setCopied] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout((): void => setCopied(false), 2500);
    } catch {
      inputRef.current?.select();
    }
  };

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>
          <h2>{t('publicLinkTitle')}</h2>
        </CardTitle>
        <CardDescription>{t('publicLinkHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="public-store-link">{t('publicLinkLabel')}</Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            ref={inputRef}
            id="public-store-link"
            readOnly
            value={url}
            className="min-h-11 flex-1"
            onFocus={(event): void => event.currentTarget.select()}
          />
          <Button type="button" variant="outline" className="min-h-11" onClick={copy}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? t('publicLinkCopied') : t('publicLinkCopy')}
          </Button>
          <Button
            nativeButton={false}
            className="min-h-11"
            render={<a href={url} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink aria-hidden="true" />
            {t('publicLinkOpen')}
          </Button>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {copied ? t('publicLinkCopied') : ''}
        </p>
      </CardContent>
    </Card>
  );
}
