import React from 'react'
import { IoIosPerson } from "react-icons/io";
import { SiGooglegemini } from "react-icons/si";

const Message = ({ role, content }) => {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] p-4 rounded-lg shadow-md ${role === 'user' ? 'bg-blue-100 rounded-br-none' : 'bg-white rounded-bl-none'}`}>
        <div className="flex items-center mb-2">
          {role === 'user' ? 
            <IoIosPerson className="text-2xl text-blue-600 mr-2" /> : 
            <SiGooglegemini className="text-2xl text-green-600 mr-2" />
          }
          <span className="text-sm font-medium text-gray-600">{role === 'user' ? 'You' : 'AI Assistant'}</span>
        </div>
        <div className="text-gray-800 whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  )
}

export default Message