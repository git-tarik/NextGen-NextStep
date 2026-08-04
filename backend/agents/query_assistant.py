from google import genai
import os
from ..services.vector_store import get_chroma_collection

def query_assistant_agent(query: str, history: list = None) -> str:
    """
    Query Assistant Agent: RAG-based FAQ chatbot.
    Retrieves relevant FAQ contexts and generates an answer using Gemini.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
         return "System Error: LLM API key not configured."
         
    # 1. Retrieve Context from ChromaDB
    try:
        collection = get_chroma_collection()
        results = collection.query(
            query_texts=[query],
            n_results=2
        )
        contexts = results['documents'][0] if results['documents'] else []
        context_str = "\n\n".join(contexts)
    except Exception as e:
        print(f"RAG Retrieval Error: {e}")
        context_str = "No relevant context found."

    # 2. Generate response using Gemini
    client = genai.Client(api_key=api_key)
    
    prompt = f"""
    You are a helpful, friendly HR Assistant for new candidates going through the onboarding process.
    If the candidate is just greeting you (e.g., 'hello', 'hi', 'how are you'), respond conversationally and ask how you can help them with their onboarding today.
    For any specific questions about onboarding, policies, or procedures, answer based STRICTLY on the following context.
    If the candidate asks a specific HR question and the context doesn't contain the answer, say: I don't have that information right now, please contact HR.
    
    Context:
    {context_str}
    
    Candidate Message: {query}
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=prompt
        )
        return response.text
    except Exception as e:
        print(f"LLM Generation Error: {e}")
        return f"Error connecting to Gemini API: {str(e)}. Please check your API key and model limits."
