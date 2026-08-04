from typing import Dict, Any
from .state import AgentState
from .nodes import _make_event

def doc_verification_agent(state: AgentState) -> Dict[str, Any]:
    """Document Verification Agent: currently mocked — bypasses real OCR/LLM verification."""
    print("--- DOC VERIFICATION AGENT (MOCKED) ---")
    documents = state.get("documents", [])
    events = state.get("timeline_events", [])
    notifications = state.get("notifications", [])

    for doc in documents:
        doc["status"] = "Mock reviewed successfully"
        doc["verification_confidence"] = 1.0
        events.append(_make_event("Document Verification", "Doc Verification Agent", f"{doc.get('type')} mock reviewed successfully"))

    missing = state.get("missing_documents", [])
    if missing:
        current_step = "doc_collection"
    else:
        current_step = "pending_hr_approval"
        events.append(_make_event("HR Approval", "Doc Verification Agent", "All documents reviewed — awaiting HR approval"))
        notifications.append({"title": "Awaiting HR Approval", "message": "All documents have been reviewed. Your HR partner will approve your onboarding shortly.", "type": "info"})

    return {
        "current_step": current_step,
        "documents": documents,
        "verification_flags": [],
        "requires_hr_review": False,
        "readiness_score": state.get("readiness_score", 30) + 10,
        "timeline_events": events,
        "notifications": notifications
    }
