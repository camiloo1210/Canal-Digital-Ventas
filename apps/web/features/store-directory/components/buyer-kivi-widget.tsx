'use client';

import { useEffect } from 'react';

interface KiviWindow extends Window {
  Kivi?: { destroy(): void };
}

/**
 * Each buyer page renders its own shell, so this component unmounts and remounts on every
 * tab change. Teardown is deferred so a remount with the same key keeps the live widget
 * (and its chat) instead of destroying and rebooting it.
 */
const TEARDOWN_DELAY_MS = 500;

interface ActiveWidget {
  key: string;
  script: HTMLScriptElement;
}

let activeWidget: ActiveWidget | null = null;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;

function teardownWidget(): void {
  if (!activeWidget) return;
  const { script } = activeWidget;
  activeWidget = null;
  // Prevent a pending download from booting after the buyer views unmount.
  script.removeAttribute('data-widget-key');
  script.removeAttribute('data-template');
  script.remove();
  (window as KiviWindow).Kivi?.destroy();
}

function cancelTeardown(): void {
  if (teardownTimer === null) return;
  clearTimeout(teardownTimer);
  teardownTimer = null;
}

/** Mount only inside buyer views; remove the global widget when leaving them. */
export function BuyerKiviWidget({
  widgetKey = 'pk_live_8C-yHAKdcUH4MOYFjwl4jpoRnt9Kes-K',
}: {
  widgetKey?: string | null;
}): null {
  useEffect((): (() => void) | undefined => {
    if (!widgetKey) return;

    cancelTeardown();

    if (activeWidget && activeWidget.key === widgetKey) {
      // Same widget already live: keep it (and the chat state) untouched.
    } else {
      teardownWidget();
      const script = document.createElement('script');
      script.src = 'https://chat-kivi.kirokusolutions.com/kivi-widget.js';
      script.dataset.widgetKey = widgetKey;
      script.dataset.template = 'sidebar';
      script.defer = true;
      document.body.appendChild(script);
      activeWidget = { key: widgetKey, script };
    }

    return (): void => {
      cancelTeardown();
      teardownTimer = setTimeout((): void => {
        teardownTimer = null;
        teardownWidget();
      }, TEARDOWN_DELAY_MS);
    };
  }, [widgetKey]);

  return null;
}
