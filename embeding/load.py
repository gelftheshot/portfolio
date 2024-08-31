import os
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import json

# Load environment variables from .env.local
load_dotenv(dotenv_path='../.env.local')

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

def process_json_file(json_file_path):
    # Load JSON data
    with open(json_file_path, 'r') as file:
        data = json.load(file)
    
    # Initialize Google Generative AI embedding model
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/embedding-001",
        google_api_key=GOOGLE_API_KEY
    )
    
    processed_data = []

    # Process general information
    general_info = (
        "Based in {}, their skills include {}. ".format(data['location'], ', '.join(data['skills'])) +
        "Education: {}. ".format(', '.join([edu['degree'] + ' from ' + edu['institution'] for edu in data['education']])) +
        "Current work: {} at {}. ".format(data['work']['role'], data['work']['company']) +
        "Interests: {}.".format(', '.join(data['interests']))
    )
    general_embedding = embeddings.embed_query(general_info)
    processed_data.append({
        "values": general_embedding,
        "id": "general_info",
        "metadata": {
            "type": "general_info",
            "content": general_info
        }
    })

    # Process projects
    for project in data['projects']:
        project_info = (
            f"Project: {project['name']}. "
            f"Description: {project['description']}. "
            f"Technologies: {project['technologies']}."
        )
        project_embedding = embeddings.embed_query(project_info)
        processed_data.append({
            "values": project_embedding,
            "id": f"project_{project['name']}",
            "metadata": {
                "type": "project",
                "name": project['name'],
                "description": project['description'],
                "technologies": project['technologies']
            }
        })

    # Process achievements
    for achievement in data['achievements']:
        achievement_info = (
            f"Achievement: {achievement['title']}. "
            f"Description: {achievement['description']}. "
            f"Date: {achievement['date']}."
        )
        achievement_embedding = embeddings.embed_query(achievement_info)
        processed_data.append({
            "values": achievement_embedding,
            "id": f"achievement_{achievement['title']}",
            "metadata": {
                "type": "achievement",
                "title": achievement['title'],
                "description": achievement['description'],
                "date": achievement['date']
            }
        })

    # Process certifications
    for cert in data['certifications']:
        cert_info = (
            f"Certification: {cert['name']}. "
            f"Issuer: {cert['issuer']}. "
            f"Date: {cert['date']}."
        )
        cert_embedding = embeddings.embed_query(cert_info)
        processed_data.append({
            "values": cert_embedding,
            "id": f"certification_{cert['name']}",
            "metadata": {
                "type": "certification",
                "name": cert['name'],
                "issuer": cert['issuer'],
                "date": cert['date'],
                "url": cert['url']
            }
        })

    # Store in Pinecone
    index.upsert(vectors=processed_data)

    print(f"Upserted {len(processed_data)} items into Pinecone index '{index_name}'")

# Call the function with your JSON file
process_json_file('./data.json')