"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CHAT_LIMITS } from "@/lib/chat-config.js";
import { createSSEParser, getChatHistory } from "@/lib/chat-protocol.js";
import Message from "./message";

const suggestions = [
  "What is Lihon’s automation focus?",
  "Tell me about Dr. Infinity",
  "Compare WanduBot and SeaSure",
];

const unavailableMessage = "The assistant is unavailable right now. Please try again or get in touch.";
class ChatResponseError extends Error {}

export default function Chat() {
  const inputId = useId();
  const [chatMessages, setChatMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const messagesRef = useRef([]);
  const chatWindowRef = useRef(null);
  const inputRef = useRef(null);
  const requestRef = useRef(null);
  const mountedRef = useRef(true);
  const turnRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current?.controller.abort();
      requestRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chatWindow = chatWindowRef.current;
    if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
  }, [chatMessages]);

  function replaceMessages(messages) {
    messagesRef.current = messages;
    setChatMessages(messages);
  }

  function updateTurn(request, turnStatus, answer) {
    replaceMessages(messagesRef.current.map((message) => {
      if (message.turn !== request.turn) return message;
      return {
        ...message,
        status: turnStatus,
        ...(message.role === "assistant" ? { content: answer } : {}),
      };
    }));
  }

  async function sendMessage(question) {
    const message = question.trim();
    if (!message || requestRef.current) return;
    if (message.length > CHAT_LIMITS.userCharacters) {
      setStatus(`Please keep your question under ${CHAT_LIMITS.userCharacters.toLocaleString("en-US")} characters.`);
      return;
    }

    const request = { controller: new AbortController(), turn: ++turnRef.current };
    const history = getChatHistory(messagesRef.current, message);
    requestRef.current = request;
    const isCurrent = () => mountedRef.current && requestRef.current === request;
    setInput("");
    setIsLoading(true);
    setStatus("Thinking…");
    replaceMessages([
      ...messagesRef.current,
      { turn: request.turn, role: "user", content: message, status: "pending" },
      { turn: request.turn, role: "assistant", content: "", status: "pending" },
    ]);

    let reader;
    let answer = "";
    let completed = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ messages: history }),
        signal: request.controller.signal,
      });
      if (!isCurrent()) return;

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        const errorMessage = result?.error?.message;
        throw new ChatResponseError(
          typeof errorMessage === "string" && errorMessage.length <= 500
            ? errorMessage
            : unavailableMessage
        );
      }
      if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
        throw new ChatResponseError(unavailableMessage);
      }

      const parser = createSSEParser(({ event, data }) => {
        if (!isCurrent() || completed) return;
        let payload;
        try {
          payload = JSON.parse(data);
        } catch {
          throw new ChatResponseError("The response was interrupted. Please try again.");
        }
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          throw new ChatResponseError("The response was interrupted. Please try again.");
        }
        if (event === "delta") {
          if (typeof payload.text !== "string") {
            throw new ChatResponseError("The response was interrupted. Please try again.");
          }
          answer += payload.text;
          updateTurn(request, "pending", answer);
          setStatus("Receiving a response…");
        } else if (event === "done") {
          completed = true;
        } else if (event === "error") {
          throw new ChatResponseError(
            typeof payload.message === "string" && payload.message.length <= 500
              ? payload.message
              : unavailableMessage
          );
        }
      });

      reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (isCurrent() && !completed) {
        const { done, value } = await reader.read();
        if (!isCurrent()) return;
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      if (!isCurrent()) return;
      parser.push(decoder.decode());
      parser.finish();

      if (!completed) throw new ChatResponseError("The response was interrupted. Please try again.");
      if (!answer.trim()) throw new ChatResponseError("The assistant returned no answer. Please try again.");

      updateTurn(request, "complete", answer);
      setStatus("Response ready.");
    } catch (error) {
      if (!isCurrent() || request.controller.signal.aborted) return;
      updateTurn(request, answer.trim() ? "incomplete" : "failed", answer);
      setStatus(answer.trim()
        ? "The response was interrupted and is incomplete. Please try again."
        : error instanceof ChatResponseError ? error.message : unavailableMessage);
    } finally {
      // A done/error event can precede EOF. Cancel any remaining stream work.
      if (reader) {
        void reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      if (isCurrent()) {
        requestRef.current = null;
        setIsLoading(false);
      }
    }
  }

  function stopResponse() {
    const request = requestRef.current;
    if (!request) return;
    requestRef.current = null;
    request.controller.abort();
    const answer = messagesRef.current.find(
      (message) => message.turn === request.turn && message.role === "assistant"
    )?.content || "";
    updateTurn(request, "stopped", answer);
    setIsLoading(false);
    setStatus("Response stopped. You can ask another question.");
    inputRef.current?.focus();
  }

  function resetConversation() {
    const request = requestRef.current;
    requestRef.current = null;
    request?.controller.abort();
    replaceMessages([]);
    setInput("");
    setIsLoading(false);
    setStatus("Conversation cleared.");
    inputRef.current?.focus();
  }

  function handleSubmit(event) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="chat">
      <div
        className="chat-messages"
        ref={chatWindowRef}
        role="region"
        aria-label="Conversation with the portfolio assistant"
        aria-live="off"
        aria-busy={isLoading}
        tabIndex={0}
      >
        {chatMessages.length === 0 ? (
          <div className="chat-empty">
            <p>What would you like to know?</p>
            <p>Pick a suggested question or type your own.</p>
          </div>
        ) : (
          chatMessages.map((message) =>
            message.content || (message.role === "assistant" && message.status !== "complete") ? (
              <Message
                key={`${message.turn}-${message.role}`}
                role={message.role}
                content={message.content}
                status={message.status}
              />
            ) : null
          )
        )}
      </div>

      {chatMessages.length === 0 && (
        <div className="chat-suggestions" aria-label="Suggested questions">
          {suggestions.map((question) => (
            <button
              key={question}
              type="button"
              disabled={isLoading}
              onClick={() => void sendMessage(question)}
            >
              {question}
            </button>
          ))}
        </div>
      )}

      <form className="chat-form" onSubmit={handleSubmit}>
        <label className="chat-label" htmlFor={inputId}>Your question</label>
        <input
          className="chat-input"
          id={inputId}
          ref={inputRef}
          name="question"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about Lihon’s AI engineering work…"
          maxLength={CHAT_LIMITS.userCharacters}
          autoComplete="off"
          required
        />
        <button
          className="chat-send"
          type="submit"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? "Replying…" : "Ask assistant"}
          <span aria-hidden="true">↗</span>
        </button>
      </form>
      <div className="chat-toolbar">
        <p className="chat-status" role="status" aria-live="polite" aria-atomic="true">
          {status}
        </p>
        {isLoading && <button className="chat-stop" type="button" onClick={stopResponse}>Stop response</button>}
        {chatMessages.length > 0 && (
          <button className="chat-reset" type="button" onClick={resetConversation}>Clear conversation</button>
        )}
      </div>
      <p className="chat-footnote">AI-generated responses based on this portfolio. For details or verification, get in touch.</p>
    </div>
  );
}
