import React from 'react'
import { IoIosPerson } from "react-icons/io";
import { SiGooglegemini } from "react-icons/si";

const Message = ({ role, content }) => {
  const isThinking = content === 'thinking';
  const thinkingDots = '.'.repeat((Date.now() / 500) % 4);

  return (
    <div className={`flex flex-col ${role === 'user' ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center mb-2 ${role === 'user' ? 'flex-row-reverse' : ''}`}>
        {role === 'user' ? 
          <IoIosPerson className="text-2xl text-blue-600 ml-2" /> : 
          <SiGooglegemini className="text-2xl text-green-600 mr-2" />
        }
        <span className="text-sm font-medium text-gray-600">{role === 'user' ? 'You' : "Lihon's AI"}</span>
      </div>
      <div className={`max-w-[70%] p-3 rounded-lg ${role === 'user' ? 'bg-blue-100 rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
        <div className="text-gray-800 whitespace-pre-wrap">
          {isThinking ? `Thinking${thinkingDots}` : content}
        </div>
      </div>
    </div>
  )
}

export default Message