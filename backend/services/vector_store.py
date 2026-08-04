import chromadb
import os
import json

def get_chroma_collection():
    chroma_client = chromadb.PersistentClient(path="./chroma_data")
    
    # Using default ChromaDB embedding function (sentence-transformers)
    collection = chroma_client.get_or_create_collection(
        name="faq_collection"
    )
    return collection

def seed_database():
    collection = get_chroma_collection()
    if collection.count() > 0:
        print("Database already seeded.")
        return
        
    print("Seeding FAQ database...")
    try:
        # Try multiple paths to find faq.json
        faq_paths = ["backend/faq.json", "faq.json", os.path.join(os.path.dirname(__file__), "..", "faq.json")]
        faqs = None
        
        for path in faq_paths:
            if os.path.exists(path):
                with open(path, "r") as f:
                    faqs = json.load(f)
                print(f"Loaded FAQ from: {path}")
                break
        
        if not faqs:
            print("Could not find faq.json")
            return
            
        documents = []
        metadatas = []
        ids = []
        
        for i, faq in enumerate(faqs):
            documents.append(f"Q: {faq['question']}\nA: {faq['answer']}")
            metadatas.append({"question": faq['question'], "answer": faq["answer"]})
            ids.append(f"faq_{i}")
            
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        print(f"Database seeded successfully with {len(faqs)} FAQ entries.")
    except Exception as e:
        print(f"Failed to seed DB: {e}")

def reseed_database():
    """Force reseed — delete existing and re-add."""
    try:
        chroma_client = chromadb.PersistentClient(path="./chroma_data")
        try:
            chroma_client.delete_collection("faq_collection")
            print("Deleted existing FAQ collection.")
        except Exception:
            pass
        seed_database()
    except Exception as e:
        print(f"Failed to reseed DB: {e}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    seed_database()
