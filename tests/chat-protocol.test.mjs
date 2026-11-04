import test from "node:test";
import assert from "node:assert/strict";
import { createSSEParser, getChatHistory } from "../lib/chat-protocol.js";
import { CHAT_LIMITS } from "../lib/chat-config.js";

function readByteChunks(chunks) {
  const events = [];
  const parser = createSSEParser((event) => events.push(event));
  const decoder = new TextDecoder();

  for (const chunk of chunks) parser.push(decoder.decode(chunk, { stream: true }));
  parser.push(decoder.decode());
  parser.finish();
  return events;
}

test("streamed Unicode and CRLF survive every possible byte boundary", () => {
  const bytes = new TextEncoder().encode(
    'event: delta\r\ndata: {"text":"Lihon’s AI → ሰላም 🧠"}\r\n\r\n' +
    'event: delta\r\ndata: {"text":" ships reliable systems."}\r\n\r\n' +
    'event: done\r\ndata: {}\r\n\r\n'
  );
  const expected = [
    { event: "delta", data: '{"text":"Lihon’s AI → ሰላም 🧠"}' },
    { event: "delta", data: '{"text":" ships reliable systems."}' },
    { event: "done", data: "{}" },
  ];

  for (let boundary = 0; boundary <= bytes.length; boundary += 1) {
    assert.deepEqual(
      readByteChunks([bytes.slice(0, boundary), bytes.slice(boundary)]),
      expected,
      `byte split ${boundary}`
    );
  }

  assert.deepEqual(
    readByteChunks(Array.from(bytes, (_, index) => bytes.slice(index, index + 1))),
    expected,
    "a network read can contain a single byte of a multibyte character"
  );
});

test("multiple delta, error, and done events retain their names and payloads", () => {
  const bytes = new TextEncoder().encode(
    'event: delta\ndata: {"text":"First"}\n\n' +
    'event: delta\ndata: {"text":" second"}\n\n' +
    'event: error\ndata: {"message":"Response interrupted."}\n\n' +
    'event: done\ndata: {}\n\n'
  );

  assert.deepEqual(readByteChunks([bytes]), [
    { event: "delta", data: '{"text":"First"}' },
    { event: "delta", data: '{"text":" second"}' },
    { event: "error", data: '{"message":"Response interrupted."}' },
    { event: "done", data: "{}" },
  ]);
});

test("comments and transport fields do not become assistant content", () => {
  const bytes = new TextEncoder().encode(
    ': keep-alive\r\nid: 42\r\nretry: 1000\r\n\r\n' +
    'event: delta\r\n: another heartbeat\r\ndata: {"text":"Answer"}\r\n\r\n' +
    'data: default event\r\n\r\n' +
    'event:\r\ndata: reset event name\r\n\r\n'
  );

  assert.deepEqual(readByteChunks([bytes]), [
    { event: "delta", data: '{"text":"Answer"}' },
    { event: "message", data: "default event" },
    { event: "message", data: "reset event name" },
  ]);
});

test("multiline data preserves newlines, empty lines, and significant spaces", () => {
  const bytes = new TextEncoder().encode(
    'event: delta\ndata: first line\ndata:  indented second line\ndata:\ndata:fourth line\n\n'
  );

  assert.deepEqual(readByteChunks([bytes]), [
    { event: "delta", data: "first line\n indented second line\n\nfourth line" },
  ]);
});

test("a final event without a trailing delimiter is flushed exactly once", () => {
  for (const ending of ["", "\n", "\r", "\r\n"]) {
    const events = [];
    const parser = createSSEParser((event) => events.push(event));
    parser.push('event: error\ndata: {"message":"Try again."}' + ending);
    assert.deepEqual(events, [], "an event is held until a delimiter or finish");
    parser.finish();
    parser.finish();

    assert.deepEqual(events, [
      { event: "error", data: '{"message":"Try again."}' },
    ]);
  }
});

test("empty event blocks do not dispatch and data with no value still dispatches", () => {
  const bytes = new TextEncoder().encode(
    '\n\nevent: discarded\n\n: comment\n\ndata\n\n'
  );

  assert.deepEqual(readByteChunks([bytes]), [{ event: "message", data: "" }]);
  assert.deepEqual(readByteChunks([]), []);
});

test("CR-only and mixed line endings work when each text character arrives separately", () => {
  const events = [];
  const parser = createSSEParser((event) => events.push(event));
  const text = 'event: delta\rdata: one\r\revent: done\r\ndata: {}\n\n';
  for (const character of text) parser.push(character);
  parser.finish();

  assert.deepEqual(events, [
    { event: "delta", data: "one" },
    { event: "done", data: "{}" },
  ]);
});

function turn(id, question, answer, status = "complete") {
  return [
    { turn: id, role: "user", content: question, status },
    { turn: id, role: "assistant", content: answer, status },
  ];
}

test("the first request contains only the latest user question", () => {
  assert.deepEqual(getChatHistory([], "How does Lihon build AI systems?"), [
    { role: "user", content: "How does Lihon build AI systems?" },
  ]);
});

test("a follow-up retains completed question and answer context without UI metadata", () => {
  const messages = turn(
    1,
    "Tell me about Dr. Infinity.",
    "Dr. Infinity uses a knowledge graph to connect medical information."
  );
  const snapshot = structuredClone(messages);

  assert.deepEqual(getChatHistory(messages, "How is that different from WanduBot?"), [
    { role: "user", content: "Tell me about Dr. Infinity." },
    { role: "assistant", content: "Dr. Infinity uses a knowledge graph to connect medical information." },
    { role: "user", content: "How is that different from WanduBot?" },
  ]);
  assert.deepEqual(messages, snapshot, "building a request must not alter the displayed conversation");
});

test("failed, incomplete, stopped, and pending turns stay out of follow-up context", () => {
  const messages = [
    ...turn(1, "What is WanduBot?", "A privacy-focused search and AI product."),
    ...turn(2, "Failed question", "", "failed"),
    ...turn(3, "Interrupted question", "Only part of an answer", "incomplete"),
    ...turn(4, "Stopped question", "An unfinished answer", "stopped"),
    ...turn(5, "Pending question", "A streaming answer", "pending"),
    ...turn(6, "What is SeaSure?", "A maritime AI platform."),
  ];

  assert.deepEqual(getChatHistory(messages, "Compare those two projects."), [
    { role: "user", content: "What is WanduBot?" },
    { role: "assistant", content: "A privacy-focused search and AI product." },
    { role: "user", content: "What is SeaSure?" },
    { role: "assistant", content: "A maritime AI platform." },
    { role: "user", content: "Compare those two projects." },
  ]);
});

test("long conversations retain recent whole turns and always end with the current question", () => {
  const messages = [];
  for (let id = 1; id <= 20; id += 1) messages.push(...turn(id, `Question ${id}`, `Answer ${id}`));
  messages.push(...turn(21, "Interrupted question", "Partial answer", "incomplete"));

  const history = getChatHistory(messages, "Compare the recent examples.");

  assert.ok(history.length <= 12, "requests fit the server conversation limit");
  assert.deepEqual(history, [
    { role: "user", content: "Question 16" },
    { role: "assistant", content: "Answer 16" },
    { role: "user", content: "Question 17" },
    { role: "assistant", content: "Answer 17" },
    { role: "user", content: "Question 18" },
    { role: "assistant", content: "Answer 18" },
    { role: "user", content: "Question 19" },
    { role: "assistant", content: "Answer 19" },
    { role: "user", content: "Question 20" },
    { role: "assistant", content: "Answer 20" },
    { role: "user", content: "Compare the recent examples." },
  ]);
});

test("long historical answers are clipped without changing the displayed conversation", () => {
  const question = "How does this architecture scale?";
  const answer = "A".repeat(CHAT_LIMITS.assistantCharacters + 2500);
  const messages = turn(1, "Explain the architecture.", answer);
  const history = getChatHistory(messages, question);

  assert.equal(history[1].content.length, CHAT_LIMITS.assistantCharacters);
  assert.equal(history[1].content, answer.slice(0, CHAT_LIMITS.assistantCharacters));
  assert.equal(messages[1].content, answer, "full answers remain visible in the UI");
  assert.deepEqual(history.at(-1), { role: "user", content: question });
});

test("history excerpts never end with a split Unicode surrogate pair", () => {
  const user = "Q".repeat(CHAT_LIMITS.userCharacters - 1) + "🧠 next";
  const assistant = "A".repeat(CHAT_LIMITS.assistantCharacters - 1) + "🌊 next";
  const messages = turn(1, user, assistant);
  const history = getChatHistory(messages, "Keep this 🧠 question unchanged.");

  assert.equal(history[0].content, "Q".repeat(CHAT_LIMITS.userCharacters - 1));
  assert.equal(history[1].content, "A".repeat(CHAT_LIMITS.assistantCharacters - 1));
  assert.equal(history.at(-1).content, "Keep this 🧠 question unchanged.");
  assert.equal(messages[0].content, user);
  assert.equal(messages[1].content, assistant);
});

test("Unicode request budgets count UTF-8 bytes and discard the oldest complete pairs", () => {
  const messages = [];
  for (let id = 1; id <= 8; id += 1) {
    messages.push(...turn(id, `Question ${id}: ` + "ሰ".repeat(1800), `Answer ${id}: ` + "🧠".repeat(3900)));
  }
  const question = "ሰ".repeat(CHAT_LIMITS.userCharacters);
  const snapshot = structuredClone(messages);
  const history = getChatHistory(messages, question);
  const byteLength = new TextEncoder().encode(JSON.stringify({ messages: history })).byteLength;

  assert.ok(byteLength <= CHAT_LIMITS.bodyBytes, `${byteLength} bytes fit the server request budget`);
  assert.ok(history.length < 11, "multibyte history is reduced beyond the message count limit");
  assert.equal(history.length % 2, 1, "history retains whole question/answer pairs");
  assert.ok(history[0].content.startsWith("Question 8:"), "the most recent complete pair remains");
  assert.ok(history[1].content.startsWith("Answer 8:"));
  assert.deepEqual(history.at(-1), { role: "user", content: question });
  assert.deepEqual(messages, snapshot, "budgeting does not truncate the visible conversation");
});

test("escaped JSON characters are included in the serialized byte budget", () => {
  const messages = [];
  for (let id = 1; id <= 5; id += 1) {
    messages.push(...turn(id, "\u0000".repeat(2000), "\u0001".repeat(8000)));
  }
  const question = "What comes next?";
  const history = getChatHistory(messages, question);

  assert.deepEqual(history, [{ role: "user", content: question }]);
  assert.ok(new TextEncoder().encode(JSON.stringify({ messages: history })).byteLength <= CHAT_LIMITS.bodyBytes);
});
