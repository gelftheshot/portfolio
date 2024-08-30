import React from 'react'
import Chat from '../../components/chat'

const AskAIPage = () => {
  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-b from-blue-50 to-red-50">
      <div className="w-full max-w-4xl h-[calc(100vh-6rem)] border border-gray-300 rounded-lg shadow-lg overflow-hidden">
        <Chat />
      </div>
    </div>
  )
}

export default AskAIPage