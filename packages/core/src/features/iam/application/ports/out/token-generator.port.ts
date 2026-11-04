export interface TokenGeneratorPort {
  /** Fresh opaque secret, shown to the user exactly once. */
  generate(): string;
  /** Lower-case hex SHA-256 digest; the only form that is ever persisted. */
  hash(rawToken: string): string;
}
