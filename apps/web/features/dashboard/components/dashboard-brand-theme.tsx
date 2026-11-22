'use client';

import { useEffect } from 'react';
import { deriveLogoTheme } from '@/features/dashboard/utils/logo-palette';

export function DashboardBrandTheme({ logoUrl }: { logoUrl: string | null }): null {
  useEffect((): (() => void) | undefined => {
    if (!logoUrl) return;

    const root = document.documentElement;
    const applied: string[] = [];
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = (): void => {
      const { naturalWidth, naturalHeight } = image;
      if (!naturalWidth || !naturalHeight) return;
      const scale = 48 / Math.max(naturalWidth, naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return;

      try {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const theme = deriveLogoTheme(context.getImageData(0, 0, canvas.width, canvas.height).data);
        if (!theme) return;
        root.style.setProperty('--dashboard-logo-background', theme.logoBackground);
        applied.push('--dashboard-logo-background');
        for (const [mode, palette] of Object.entries(theme.palette ?? {})) {
          for (const [token, value] of Object.entries(palette)) {
            const name = '--dashboard-brand-' + mode + '-' + token;
            root.style.setProperty(name, value);
            applied.push(name);
          }
        }
      } catch {
        // Logos whose origin disallows pixel access still render with the default theme.
      }
    };
    image.src = logoUrl;

    return (): void => {
      image.onload = null;
      image.removeAttribute('src');
      for (const name of applied) root.style.removeProperty(name);
    };
  }, [logoUrl]);

  return null;
}
