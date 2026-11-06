'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import type { IntelligenceQuery } from '@canaldigital/packages/core';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TenantIdField } from '@/features/dashboard/components/tenant-scope';
import {
  generateBusinessAdviceAction,
  type BusinessAdviceActionState,
} from '@/features/dashboard/actions/business-advice.actions';
import { intelligenceRangeStart } from '@/features/dashboard/utils/business-intelligence-range';

const INITIAL_STATE: BusinessAdviceActionState = {
  status: 'idle',
  errorCode: null,
  message: null,
  advice: null,
  revision: 0,
};

export function BusinessIntelligenceAdvisor({
  query,
}: {
  query: IntelligenceQuery;
}): React.JSX.Element {
  const t = useTranslations('BusinessIntelligence');
  const [state, action, isPending] = useActionState(generateBusinessAdviceAction, INITIAL_STATE);
  return (
    <Card id="bi-advisor" className="scroll-mt-20 sm:[--card-spacing:--spacing(5)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            {t('advisorTitle')}
          </CardTitle>
          <Badge variant="outline">{t('advisorBeta')}</Badge>
        </div>
        <CardDescription>{t('advisorHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={action} className="flex flex-wrap items-center gap-3">
          <TenantIdField />
          {query.endDate ? (
            <>
              <input type="hidden" name="from" value={intelligenceRangeStart(query) ?? ''} />
              <input type="hidden" name="to" value={query.endDate} />
            </>
          ) : (
            <input type="hidden" name="days" value={query.days} />
          )}
          <input type="hidden" name="leadTimeDays" value={query.leadTimeDays} />
          <input type="hidden" name="targetCoverageDays" value={query.targetCoverageDays} />
          <Button type="submit" className="min-h-11" disabled={isPending} aria-busy={isPending}>
            {isPending
              ? t('advisorAnalyzing')
              : state.advice
                ? t('advisorRetry')
                : t('advisorAnalyze')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('advisorPrivacy')}</p>
        </form>
        <div aria-live="polite">
          {state.status === 'error' && state.message && (
            <Alert role="alert">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}
          {state.advice && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed">{state.advice.summary}</p>
              <ul className="grid gap-3 md:grid-cols-2">
                {state.advice.tips.map((tip): React.JSX.Element => (
                  <li
                    key={`${tip.category}-${tip.title}`}
                    className="rounded-lg border bg-muted/20 p-4"
                  >
                    <Badge variant="secondary">{t(`advisorCategory.${tip.category}`)}</Badge>
                    <p className="mt-2 font-medium">{tip.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {tip.detail}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{t('advisorDisclaimer')}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
