import * as React from 'react';
import { BuyerShell } from '@/features/store-directory/components/buyer-shell';
import { getStoreViewerQuery } from '@/features/store/queries/store-viewer.query';

/**
 * Shared by every buyer page. Layouts survive client navigation, so the shell and the
 * Kivi chat widget stay mounted when the buyer switches tabs.
 */
export default async function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const viewer = await getStoreViewerQuery();
  return <BuyerShell viewer={viewer}>{children}</BuyerShell>;
}
