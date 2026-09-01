export interface ProcessWebhookDto {
  gateway: string;
  payload: string;
  signature: string;
  tenantId: string;
}
