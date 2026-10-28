export declare const LOGIN: 'canaldigital_kivi_sync';
export declare class KiviLoginProvisioningException extends Error {
  constructor(message: string);
}
export declare function buildWorkerUrl(adminUrl: string, password: string): string;
export declare function validatePassword(password: string | undefined): void;
