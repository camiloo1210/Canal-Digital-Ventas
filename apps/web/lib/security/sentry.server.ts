import 'server-only';

import * as Sentry from '@sentry/nextjs';

if (!Sentry.getClient()) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled: Boolean(process.env.SENTRY_DSN),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0,
    // Only explicitly reported security signals are needed for this integration.
    defaultIntegrations: false,
    beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
      delete event.request;
      delete event.user;
      delete event.breadcrumbs;
      return event;
    },
  });
}
