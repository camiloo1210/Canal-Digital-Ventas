export interface KiviStoreWidget {
  widgetKey: string;
}
export interface KiviStoreWidgetReadPort {
  findForStoreSlug(slug: string): Promise<KiviStoreWidget | null>;
}
