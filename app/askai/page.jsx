import React from 'react'
import Chat from '../../components/chat'

const AskAIPage = () => {
  return (
    <div className="h-[calc(100vh-6rem)] bg-gradient-to-b from-blue-50 to-red-50">
      <div className="h-full w-full">
        <Chat />
      </div>
    </div>
  )
}

export default AskAIPage