"use client";
import { useState, useEffect, useRef } from "react";
import Message from "./message";

const Chat = () => {
  const [chatMessages, setChatMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingDots, setThinkingDots] = useState(0);
  const chatWindowRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setChatMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Start the thinking animation
    const thinkingInterval = setInterval(() => {
      setThinkingDots(dots => (dots + 1) % 4);
    }, 500);

    setChatMessages(prev => [...prev, { role: 'assistant', content: 'thinking' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';

      clearInterval(thinkingInterval);
      setThinkingDots(0);

      const streamCharacters = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (let char of chunk) {
            aiResponse += char;
            setChatMessages(prev => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = { role: 'assistant', content: aiResponse };
              return newMessages;
            });
            await new Promise(resolve => setTimeout(resolve, 5)); // Reduced from 20 to 5 milliseconds
          }
        }
      };

      await streamCharacters();
    } catch (error) {
      console.error('Error:', error);
      setChatMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: 'assistant', content: 'Sorry, there was an error processing your request.' };
        return newMessages;
      });
    } finally {
      clearInterval(thinkingInterval);
      setThinkingDots(0);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [chatMessages]);

  return (
    <div className="flex flex-col h-full">
      <div 
        ref={chatWindowRef} 
        className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain"
        style={{ 
          maxHeight: 'calc(100vh - 14rem)',
          minHeight: '0'
        }}
      >
        {chatMessages.map((message, index) => (
          <Message key={index} role={message.role} content={message.content} />
        ))}
      </div>
      <footer className="border-t border-gray-200 p-4 bg-white mt-auto">
        <form onSubmit={handleSubmit} className="relative">
          <input
            className="w-full p-4 pr-20 text-gray-700 bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={input}
            placeholder="Ask about Lihon..."
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`absolute right-2 top-2 ${
              isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
            } text-white px-4 py-2 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors`}
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