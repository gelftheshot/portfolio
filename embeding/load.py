import os
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from langchain_community.vectorstores import Pinecone as LangchainPinecone
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import json

# Load environment variables from .env.local
load_dotenv(dotenv_path='.env.local')

# Get API keys
PINECONE_API_KEY = os.getenv('PINECONE_API_KEY')
GOOGLE_API_KEY = os.getenv('GOOGLE_GENERATIVE_AI_API_KEY')

if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_GENERATIVE_AI_API_KEY not found in environment variables")

index_name = 'portfolio-index'
dim = 768  # Dimension for embeddings

# Initialize Pinecone client
pc = Pinecone(api_key=PINECONE_API_KEY)

# Check if index exists and create if it doesn't
if index_name in pc.list_indexes().names():
    pc.delete_index(index_name)
pc.create_index(
    name=index_name,
    dimension=dim,
    metric="cosine",
    spec=ServerlessSpec(
        cloud="aws",
        region="us-east-1"
    )
)
print(f"Created new index '{index_name}' with dimension {dim}")

# Get the index
index = pc.Index(index_name)

def json_file_path(json_file_path):
    # Load JSON data
    with open(json_file_path, 'r') as file:
        data = json.load(file)
    
    # Initialize Google Generative AI embedding model
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/embedding-001",
        google_api_key=GOOGLE_API_KEY
    )
    
    processed_data = []
    for professor in data['professors']:
        # Create a comprehensive summary of the professor
        summary = (
            f"Professor {professor['name']} is a {professor['sex']} educator in the {professor['department']} department. "
            f"They teach {', '.join(professor['subjects'])} and are known for {professor['knownFor']}. "
            f"With {professor['yearsTeaching']} years of teaching experience and {professor['publications']} publications, "
            f"they have a rating of {professor['rating']}. Their research interests include {' and '.join(professor['researchInterests'])}. "
            f"Awards: {', '.join(professor['awards'])}. Fun fact: {professor['funFact']}"
        )
        
        # Create embedding for the summary
        embedding = embeddings.embed_query(summary)
        
        # Prepare the data for storage
        processed_data.append({
            "values": embedding,
            "id": f"professor_{professor['id']}",
            "metadata": {
                "name": professor['name'],
                "sex": professor['sex'],
                "department": professor['department'],
                "subjects": professor['subjects'],
                "known_for": professor['knownFor'],
                "rating": professor['rating'],
                "years_teaching": professor['yearsTeaching'],
                "publications": professor['publications'],
                "awards": professor['awards'],
                "office_hours": professor['officeHours'],
                "research_interests": professor['researchInterests'],
                "fun_fact": professor['funFact']
            }
        })
    
    # Store in Pinecone
    index = pc.Index(index_name)
    index.upsert(vectors=processed_data)

    print(f"Upserted {len(processed_data)} professors into Pinecone index '{index_name}'")

# Call the function with your JSON file
json_file_path('data.json')