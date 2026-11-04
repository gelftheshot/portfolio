import { CHAT_LIMITS } from "./chat-config.js";

/** Parse an SSE stream incrementally, including CRLF split across chunks. */
export function createSSEParser(onEvent) {
  let line = "";
  let eventName = "message";
  let dataLines = [];
  let previousWasCarriageReturn = false;

  function dispatch() {
    if (dataLines.length) onEvent({ event: eventName, data: dataLines.join("\n") });
    eventName = "message";
    dataLines = [];
  }

  function consumeLine() {
    const currentLine = line;
    line = "";
    if (!currentLine) {
      dispatch();
      return;
    }
    if (currentLine.startsWith(":")) return;

    const separator = currentLine.indexOf(":");
    const field = separator === -1 ? currentLine : currentLine.slice(0, separator);
    let value = separator === -1 ? "" : currentLine.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") eventName = value || "message";
    if (field === "data") dataLines.push(value);
  }

  return {
    push(chunk) {
      for (const character of chunk) {
        if (character === "\n" && previousWasCarriageReturn) {
          previousWasCarriageReturn = false;
          continue;
        }
        previousWasCarriageReturn = character === "\r";
        if (character === "\r" || character === "\n") consumeLine();
        else line += character;
      }
    },
    finish() {
      if (line) consumeLine();
      dispatch();
    },
  };
}

/** Only successful turns belong in the next request's conversation context. */
export function getChatHistory(messages, question) {
  const completed = messages
    .filter((message) => message.status === "complete" && message.content.trim())
    .map(({ role, content }) => {
      const limit = role === "assistant" ? CHAT_LIMITS.assistantCharacters : CHAT_LIMITS.userCharacters;
      let excerpt = content.slice(0, limit);
      const lastCodeUnit = excerpt.charCodeAt(excerpt.length - 1);
      // JavaScript counts emoji as two characters; never send half a surrogate pair.
      if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) excerpt = excerpt.slice(0, -1);
      return { role, content: excerpt };
    });
  const pairs = [];
  for (let index = 0; index < completed.length - 1; index += 1) {
    if (completed[index].role === "user" && completed[index + 1].role === "assistant") {
      pairs.push(completed[index], completed[index + 1]);
      index += 1;
    }
  }
  const previousMessageLimit = Math.floor((CHAT_LIMITS.messages - 1) / 2) * 2;
  const history = [
    ...pairs.slice(-previousMessageLimit),
    { role: "user", content: question },
  ];
  const encoder = new TextEncoder();
  while (
    history.length > 1 &&
    encoder.encode(JSON.stringify({ messages: history })).byteLength > CHAT_LIMITS.bodyBytes
  ) {
    history.splice(0, 2);
  }
  return history;
}
