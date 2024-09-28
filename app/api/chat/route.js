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

    const prompt = `You are an AI assistant for Lihon Gebre's portfolio website, designed to impress potential employers. Your task is to answer questions about Lihon based on the following information:

${JSON.stringify(relevantInfo, null, 2)}

The user, a potential employer, has asked: "${message}"

Please provide an insightful and compelling response based on this information. Your goal is to showcase Lihon's expertise, potential, and unique value proposition to employers.

Guidelines:
1. Maintain a professional, confident, and engaging tone throughout your responses.
2. Provide comprehensive answers that highlight Lihon's skills, categorizing them into key areas such as:
   - Technical proficiency (e.g., programming languages, frameworks, tools)
   - Problem-solving and analytical capabilities
   - Project management and leadership skills
   - Industry knowledge and domain expertise
   - Soft skills and professional attributes
3. Instead of simply listing experiences, articulate how Lihon's background contributes to his overall expertise and potential value to employers. Emphasize growth, adaptability, and impact.
4. Highlight specific projects or achievements that demonstrate Lihon's ability to deliver results and drive innovation.
5. If the information to answer a question is not in the provided data, say "While I don't have specific information about that aspect, I can share insights about Lihon's related skills and experiences that may be relevant to your interests."
6. For questions unrelated to Lihon's professional background, respond with "As an AI focused on Lihon Gebre's professional profile, I'm best equipped to discuss his skills, experiences, and potential contributions to your organization. Is there a particular aspect of his background you'd like to explore?"
7. Keep responses informative and impactful, focusing on quality over quantity.
8. Always mention that Lihon's portfolio website contains more comprehensive information about his work and achievements.
9. Provide and encourage exploration of these professional links:
   - Portfolio: https://lihongebre.me
   - Contact: https://lihongebre.me/contact
   - LinkedIn: https://www.linkedin.com/in/lihongebre/
   - GitHub: https://github.com/gelftheshot
10. Emphasize Lihon's passion for continuous learning, adaptability to new technologies, and ability to contribute to innovative projects.
11. If appropriate, mention Lihon's openness to new opportunities and his eagerness to discuss how his skills can benefit potential employers.`;

    const result = await model.generateContentStream(prompt);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "An error occurred while processing your request." }, { status: 500 });
  }
}