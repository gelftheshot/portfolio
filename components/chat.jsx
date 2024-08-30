"use client";
import { useState, useRef, useEffect } from "react";
import { useCompletion } from 'ai/react';
import { v4 as uuidv4 } from 'uuid';
import Message from "./message";

const Chat = () => {
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [streamingMessage, setStreamingMessage] = useState(null);
  const textareaRef = useRef(null);
  const chatWindowRef = useRef(null);
  const { completion, complete, isLoading } = useCompletion({
    api: '/api/chat',
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 150);
      textareaRef.current.style.height = newHeight + "px";
      const borderRadius = newHeight > 40 ? "1rem" : "9999px";
      textareaRef.current.style.borderRadius = borderRadius;
    }
  }, [message]);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [chatMessages, streamingMessage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMessage = { _id: uuidv4(), text: message, role: "user" };
    setChatMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setStreamingMessage({ _id: uuidv4(), text: "", role: "assistant" });

    try {
      await complete(message);
    } catch (error) {
      console.error("Error completing message:", error);
      setStreamingMessage(null);
      setChatMessages((prev) => [
        ...prev,
        {
          _id: uuidv4(),
          text: "An error occurred while processing your request.",
          role: "assistant"
        }
      ]);
    }
  };

  useEffect(() => {
    if (completion) {
      setStreamingMessage((prev) => 
        prev ? { ...prev, text: completion } : null
      );
    }
  }, [completion]);

  useEffect(() => {
    if (!isLoading && streamingMessage) {
      setChatMessages((prev) => [...prev, streamingMessage]);
      setStreamingMessage(null);
    }
  }, [isLoading, streamingMessage]);

  return (
    <div className="flex flex-col h-full">
      <div ref={chatWindowRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {chatMessages.map(message => (
          <Message key={message._id} role={message.role} content={message.text} />
        ))}
        {streamingMessage && (
          <Message role={streamingMessage.role} content={streamingMessage.text || "Thinking..."} />
        )}
      </div>
      <footer className="border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={textareaRef}
            className="w-full p-4 pr-20 text-gray-700 bg-white border-2 border-gray-300 rounded-lg resize-none transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ maxHeight: "150px", minHeight: "50px", overflowY: "auto" }}
            rows="1"
            placeholder="Ask your question about Lihon..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          ></textarea>
          <button
            type="submit"
            className="absolute right-3 bottom-3 bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
            disabled={isLoading}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </footer>
    </div>
  );
};

export default Chat;