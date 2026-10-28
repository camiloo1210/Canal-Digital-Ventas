'use client';

import { useEffect } from 'react';

interface KiviWindow extends Window {
  Kivi?: { destroy(): void };
}

/** Mount only inside buyer views; remove the global widget when leaving them. */
export function BuyerKiviWidget({
  widgetKey = 'pk_live_8C-yHAKdcUH4MOYFjwl4jpoRnt9Kes-K',
}: {
  widgetKey?: string | null;
}): null {
  useEffect((): (() => void) | undefined => {
    if (!widgetKey) return;
    const script = document.createElement('script');
    script.src = 'https://chat-kivi.kirokusolutions.com/kivi-widget.js';
    script.dataset.widgetKey = widgetKey;
    script.dataset.template = 'sidebar';
    script.defer = true;
    document.body.appendChild(script);

    return (): void => {
      // Prevent a pending download from booting after this buyer view unmounts.
      script.removeAttribute('data-widget-key');
      script.removeAttribute('data-template');
      script.remove();
      (window as KiviWindow).Kivi?.destroy();
    };
  }, [widgetKey]);

  return null;
}
