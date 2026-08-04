from typing import Dict, Any
from .state import AgentState
import os
import datetime
from google import genai
from google.genai import types

def doc_verification_agent(state: AgentState) -> Dict[str, Any]:
    """Document Verification Agent: OCR and LLM verification."""
    print("--- DOC VERIFICATION AGENT ---")
    documents = state.get("documents", [])
    flags = state.get("verification_flags", [])
    requires_hr_review = state.get("requires_hr_review", False)
    events = state.get("timeline_events", [])
    notifications = state.get("notifications", [])
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Warning: GEMINI_API_KEY not set. Mocking verification.")
        # Mock: mark all docs as verified for demo
        for doc in documents:
            if doc.get("status") != "verified":
                doc["status"] = "verified"
                doc["verification_confidence"] = 0.95
        events.append({
            "step": "Document Verification",
            "agent": "Doc Verification Agent",
            "detail": "Documents verified (mock mode — no API key)",
            "timestamp": datetime.datetime.utcnow().isoformat()
        })
        return {
            "current_step": "doc_verification",
            "documents": documents,
            "readiness_score": state.get("readiness_score", 30) + 10,
            "timeline_events": events,
            "notifications": notifications
        }
        
    client = genai.Client(api_key=api_key)
    
    # Optional: configure Tesseract path if it's set in env
    tesseract_cmd = os.environ.get("TESSERACT_CMD")
    
    for doc in documents:
        if doc.get("status") == "verified":
            continue
            
        file_path = doc.get("file_path")
        doc_type = doc.get("type")
        
        if not file_path or not os.path.exists(file_path):
            continue
            
        try:
            extracted_text = ""
            
            # Try OCR for image files
            if file_path.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                try:
                    import pytesseract
                    from PIL import Image
                    if tesseract_cmd and os.path.exists(tesseract_cmd):
                        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
                    extracted_text = pytesseract.image_to_string(Image.open(file_path))
                except Exception as ocr_err:
                    print(f"OCR failed for {doc_type}: {ocr_err}")
                    extracted_text = f"[OCR unavailable for {doc_type}]"
            else:
                # For PDFs and other formats, just note the type
                extracted_text = f"[File type: {os.path.splitext(file_path)[1]}] — content extraction pending"
            
            # LLM Verification
            prompt = f"Verify this is a {doc_type}. Text: {extracted_text}. Return JSON: {{'is_valid': bool, 'confidence': float (0-1), 'reason': '...'}}"
            
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            
            import json
            try:
                result = json.loads(response.text)
                confidence = result.get("confidence", 0)
                doc["verification_confidence"] = confidence
                
                if result.get("is_valid") and confidence > 0.7:
                    doc["status"] = "verified"
                    events.append({
                        "step": "Document Verification",
                        "agent": "Doc Verification Agent",
                        "detail": f"{doc_type} verified (confidence: {confidence:.0%})",
                        "timestamp": datetime.datetime.utcnow().isoformat()
                    })
                else:
                    doc["status"] = "flagged"
                    flags.append(f"Flagged {doc_type}: {result.get('reason', 'Low confidence')}")
                    requires_hr_review = True
                    events.append({
                        "step": "Document Verification",
                        "agent": "Doc Verification Agent",
                        "detail": f"{doc_type} flagged for manual review: {result.get('reason', 'Low confidence')}",
                        "timestamp": datetime.datetime.utcnow().isoformat()
                    })
                    notifications.append({
                        "title": f"Document Flagged: {doc_type}",
                        "message": f"Your {doc_type} requires additional review. Reason: {result.get('reason', 'Verification confidence below threshold')}",
                        "type": "warning"
                    })
            except Exception as e:
                 print(f"Failed to parse LLM JSON: {e}")
                 flags.append(f"Failed verification for {doc_type}: Invalid response")
                 requires_hr_review = True

        except Exception as e:
             print(f"Error processing {doc_type}: {e}")
             flags.append(f"Error for {doc_type}: {str(e)}")
             requires_hr_review = True

    return {
        "current_step": "doc_verification",
        "documents": documents,
        "verification_flags": flags,
        "requires_hr_review": requires_hr_review,
        "readiness_score": state.get("readiness_score", 30) + 10,
        "timeline_events": events,
        "notifications": notifications
    }
