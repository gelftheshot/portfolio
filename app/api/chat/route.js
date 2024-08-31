import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = 'portfolio-index';
const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

export async function POST(req) {
  try {
    const { message } = await req.json();

    // Initialize Pinecone client
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.Index(PINECONE_INDEX);

    // Create embedding for the user's query
    const embeddings = new GoogleGenerativeAIEmbeddings({
      modelName: "models/embedding-001",
      apiKey: GOOGLE_API_KEY,
    });
    const queryEmbedding = await embeddings.embedQuery(message);

    // Query Pinecone
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 3,
      includeMetadata: true,
    });

    const relevantInfo = queryResponse.matches.map(match => match.metadata);
    
    // Initialize Google Generative AI
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `You are an AI assistant for Lihon Gebre's portfolio website. Your task is to answer questions about Lihon based on the following information:

${JSON.stringify(relevantInfo, null, 2)}

The user has asked: "${message}"

Please provide a helpful and concise response based on this information. If the question is not about Lihon or his professional background, politely explain that you can only answer questions about Lihon Gebre and his work.

Guidelines:
1. Be friendly and professional in your tone.
2. If the information to answer the question is not in the provided data, say "I don't have specific information about that, but I'd be happy to tell you what I do know about Lihon's background in related areas."
3. If the question is completely unrelated to Lihon or his work, respond with "I'm sorry, but I can only answer questions about Lihon Gebre and his professional background. Is there anything specific about Lihon's skills, projects, or experience you'd like to know?"
4. Keep your answers concise and to the point.
5. If appropriate, encourage the user to check out Lihon's projects or get in touch with him for more information.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();

    return NextResponse.json({ message: generatedText });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "An error occurred while processing your request." }, { status: 500 });
  }
}