import type {
  DeliveryClaim,
  NotificationLocale,
} from '@/notifications/application/ports/out/notification.ports';

export type MerchantNotificationKind = 'new_order' | 'paid' | 'cancelled' | 'low_stock';
export interface MerchantStockItem {
  productId: string;
  name: string;
  sku: string;
  stock: number;
}
export interface MerchantOrderRecipient {
  userId: string;
  email: string;
  orderNumber: string;
  tenantName: string;
  stockItems: MerchantStockItem[];
}
export interface MerchantNotificationReadPort {
  findRecipients(
    messageId: string,
    tenantId: string,
    orderId: string,
    eventType: string,
  ): Promise<MerchantOrderRecipient[]>;
}
export interface MerchantDeliveryKey {
  messageId: string;
  userId: string;
  kind: MerchantNotificationKind;
}
export interface MerchantNotificationDeliveryPort {
  claim(key: MerchantDeliveryKey): Promise<DeliveryClaim>;
  complete(key: MerchantDeliveryKey): Promise<void>;
  fail(key: MerchantDeliveryKey, terminal: boolean): Promise<void>;
}
export interface MerchantNotificationEmail extends MerchantOrderRecipient {
  messageId: string;
  kind: MerchantNotificationKind;
  locale: NotificationLocale;
}
export interface MerchantNotificationEmailPort {
  sendMerchant(email: MerchantNotificationEmail): Promise<void>;
}
export interface MerchantNotificationCopy {
  subjects: Record<MerchantNotificationKind, string>;
  body: string;
  stockLine: string;
}
export type MerchantNotificationCopies = Record<NotificationLocale, MerchantNotificationCopy>;
