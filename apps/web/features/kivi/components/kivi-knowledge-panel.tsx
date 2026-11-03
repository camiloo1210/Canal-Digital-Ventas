'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { BookOpen, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  configureKiviKnowledgeAction,
  type KiviKnowledgeActionState,
} from '@/features/kivi/actions/kivi-knowledge.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export interface KiviKnowledgeDocumentView {
  externalId: string;
  name: string;
  status: 'pending' | 'indexed' | 'failed';
  updatedAt: string;
}

const INITIAL: KiviKnowledgeActionState = { success: false, message: null };
const POLL_MS = 5000;

export function KiviKnowledgePanel({
  linked,
  documents,
  available,
  maxDocuments,
}: {
  linked: boolean;
  documents: KiviKnowledgeDocumentView[];
  /** false when Kivi could not be queried; uploads stay possible but the list is unknown. */
  available: boolean;
  maxDocuments: number;
}): React.JSX.Element {
  const t = useTranslations('KiviKnowledge');
  const format = useFormatter();
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [replacing, setReplacing] = useState<KiviKnowledgeDocumentView | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [state, action, pending] = useActionState(
    async (
      previous: KiviKnowledgeActionState,
      data: FormData,
    ): Promise<KiviKnowledgeActionState> => {
      const result = await configureKiviKnowledgeAction(previous, data);
      if (result.success) {
        setFormKey((key: number): number => key + 1);
        setReplacing(null);
      }
      if (data.get('operation') === 'delete') setDeleting(null);
      return result;
    },
    INITIAL,
  );
  const [editedState, setEditedState] = useState<KiviKnowledgeActionState | null>(null);
  const errors = editedState === state ? undefined : state.fieldErrors;
  const hasPending = documents.some((doc): boolean => doc.status === 'pending');

  // Indexing finishes in the background on Kivi; follow it until nothing is pending.
  useEffect((): (() => void) | undefined => {
    if (!hasPending) return undefined;
    const timer = setInterval((): void => router.refresh(), POLL_MS);
    return (): void => clearInterval(timer);
  }, [hasPending, router]);

  const statusLabel = (status: KiviKnowledgeDocumentView['status']): string =>
    status === 'indexed'
      ? t('statusIndexed')
      : status === 'failed'
        ? t('statusFailed')
        : t('statusPending');

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <BookOpen aria-hidden="true" className="size-5" />
            <h2>{t('title')}</h2>
          </CardTitle>
          <Badge variant="secondary">
            {available
              ? t('count', { count: documents.length, max: maxDocuments })
              : t('statusUnknown')}
          </Badge>
        </div>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t('privacy')}
        </p>
        {!linked && (
          <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
            {t('linkFirst')}
          </p>
        )}

        <form
          key={formKey}
          action={action}
          noValidate
          aria-busy={pending}
          className="space-y-4"
          onChange={(): void => setEditedState(state)}
        >
          <input type="hidden" name="operation" value="upload" />
          <input type="hidden" name="documentId" value={replacing?.externalId ?? ''} />
          <fieldset disabled={!linked || pending} className="min-w-0 space-y-4 disabled:opacity-60">
            {replacing && (
              <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                <span>{t('replacing', { name: replacing.name })}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={(): void => setReplacing(null)}
                >
                  {t('cancelReplace')}
                </Button>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="knowledge-file">{t('file')}</Label>
              <Input
                id="knowledge-file"
                name="file"
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="min-h-11"
                aria-invalid={Boolean(errors?.file)}
                aria-describedby="knowledge-file-help"
              />
              <p
                id="knowledge-file-help"
                className={
                  errors?.file ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
                }
              >
                {errors?.file ?? t('fileHelp')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="knowledge-title">{t('docTitle')}</Label>
              <Input
                id="knowledge-title"
                name="title"
                className="min-h-11"
                defaultValue={state.values?.title ?? ''}
                maxLength={500}
                autoComplete="off"
                aria-invalid={Boolean(errors?.title)}
                aria-describedby="knowledge-title-help"
              />
              <p
                id="knowledge-title-help"
                className={
                  errors?.title ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
                }
              >
                {errors?.title ?? t('docTitleHelp')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="knowledge-text">{t('text')}</Label>
              <Textarea
                id="knowledge-text"
                name="text"
                rows={6}
                defaultValue={state.values?.text ?? ''}
                aria-invalid={Boolean(errors?.content)}
                aria-describedby="knowledge-text-help"
              />
              <p
                id="knowledge-text-help"
                className={
                  errors?.content ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
                }
              >
                {errors?.content ?? t('textHelp')}
              </p>
            </div>
            <Button type="submit" className="min-h-11">
              {pending ? t('working') : replacing ? t('replace') : t('upload')}
            </Button>
          </fieldset>
        </form>

        {state.message && editedState !== state && (
          <p
            role={state.success ? 'status' : 'alert'}
            className={`rounded-lg border p-3 text-sm ${state.success ? 'border-success/30 text-success' : 'border-destructive/30 text-destructive'}`}
          >
            {state.message}
          </p>
        )}

        <section aria-labelledby="knowledge-list-title" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 id="knowledge-list-title" className="text-sm font-medium">
              {t('listTitle')}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={(): void => router.refresh()}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              {t('refresh')}
            </Button>
          </div>
          {!available ? (
            <p role="status" className="rounded-lg border bg-muted/40 p-4 text-sm">
              {t('listUnavailable')}
            </p>
          ) : documents.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {t('empty')}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {documents.map((doc): React.JSX.Element => (
                <li
                  key={doc.externalId}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText
                      aria-hidden="true"
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium capitalize">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format.dateTime(new Date(doc.updatedAt), {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={doc.status === 'failed' ? 'destructive' : 'secondary'}>
                      {statusLabel(doc.status)}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      disabled={pending}
                      onClick={(): void => setReplacing(doc)}
                    >
                      {t('replaceAction')}
                    </Button>
                    {doc.status === 'failed' && (
                      <form action={action}>
                        <input type="hidden" name="operation" value="retry" />
                        <input type="hidden" name="documentId" value={doc.externalId} />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          className="min-h-11"
                          disabled={pending}
                        >
                          {t('retry')}
                        </Button>
                      </form>
                    )}
                    <Dialog
                      open={deleting === doc.externalId}
                      onOpenChange={(open: boolean): void => {
                        if (!pending) setDeleting(open ? doc.externalId : null);
                      }}
                    >
                      <DialogTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-11"
                            disabled={pending}
                          />
                        }
                      >
                        {t('delete')}
                      </DialogTrigger>
                      <DialogContent closeLabel={t('cancel')} showCloseButton={!pending}>
                        <DialogHeader>
                          <DialogTitle>{t('delete')}</DialogTitle>
                          <DialogDescription>
                            {t('deleteHelp', { name: doc.name })}
                          </DialogDescription>
                        </DialogHeader>
                        <form action={action}>
                          <input type="hidden" name="operation" value="delete" />
                          <input type="hidden" name="documentId" value={doc.externalId} />
                          <Button
                            type="submit"
                            variant="destructive"
                            className="min-h-11"
                            disabled={pending}
                          >
                            {t('confirmDelete')}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
