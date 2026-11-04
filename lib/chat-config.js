/** Shared limits keep browser history within the server's request budget. */
export const CHAT_LIMITS = Object.freeze({
  bodyBytes: 32768,
  messages: 12,
  userCharacters: 2000,
  assistantCharacters: 8000,
});
