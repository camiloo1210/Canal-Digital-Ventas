export interface KiviEncryptedToken {
  /** Self-describing envelope (version, IV, ciphertext, auth tag). Safe to persist. */
  readonly ciphertext: string;
  /** Key generation that produced the envelope (smallint column). */
  readonly keyVersion: number;
}
