from typing import Dict, Any, List
from .state import AgentState
import datetime

def _make_event(step: str, agent: str, detail: str) -> Dict[str, str]:
    """Create a timeline event entry."""
    return {
        "step": step,
        "agent": agent,
        "detail": detail,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

def intake_agent(state: AgentState) -> Dict[str, Any]:
    """Onboarding Intake Agent: Determines needed docs based on role."""
    print("--- INTAKE AGENT ---")
    events = state.get("timeline_events", [])
    events.append(_make_event("Intake", "Intake Agent", "Onboarding initiated — required documents determined"))
    
    return {
        "current_step": "intake",
        "missing_documents": ["ID", "Degree", "Offer Letter"],
        "bgv_status": "pending",
        "provisioning_status": {"hr": "pending", "payroll": "pending", "it": "pending"},
        "readiness_score": 10,
        "timeline_events": events,
        "notifications": [{"title": "Welcome!", "message": "Your onboarding has started. Please upload required documents.", "type": "info"}],
        "compliance_checks": [{"check": "Document Collection", "status": "pending"}, {"check": "Background Verification", "status": "pending"}, {"check": "HR Record", "status": "pending"}]
    }

def doc_collection_agent(state: AgentState) -> Dict[str, Any]:
    """Document Collection Agent: Checks if required docs are uploaded."""
    print("--- DOC COLLECTION AGENT ---")
    uploaded_types = [doc["type"] for doc in state.get("documents", [])]
    required = ["ID", "Degree", "Offer Letter"]
    missing = [req for req in required if req not in uploaded_types]
    
    events = state.get("timeline_events", [])
    notifications = state.get("notifications", [])
    
    # Weighted scoring: each doc = 7 points (21 total for all 3)
    doc_score = (len(required) - len(missing)) * 7
    score = 10 + doc_score  # base 10 from intake
    
    if not missing:
        events.append(_make_event("Document Collection", "Doc Collection Agent", "All required documents received"))
        notifications.append({"title": "Documents Complete", "message": "All required documents have been uploaded successfully.", "type": "success"})
    else:
        events.append(_make_event("Document Collection", "Doc Collection Agent", f"Missing documents: {', '.join(missing)}"))
        notifications.append({"title": "Documents Needed", "message": f"Please upload: {', '.join(missing)}", "type": "warning"})
        
    return {
        "current_step": "doc_collection",
        "missing_documents": missing,
        "readiness_score": score,
        "timeline_events": events,
        "notifications": notifications
    }

def bgv_agent(state: AgentState) -> Dict[str, Any]:
    """BGV Coordination Agent: Initiates background verification."""
    print("--- BGV AGENT ---")
    events = state.get("timeline_events", [])
    notifications = state.get("notifications", [])
    
    if state.get("requires_hr_review"):
        events.append(_make_event("BGV", "BGV Agent", "Background verification flagged — manual review required"))
        notifications.append({"title": "Review Required", "message": "Your background verification requires manual review.", "type": "warning"})
        return {
            "bgv_status": "flagged",
            "timeline_events": events,
            "notifications": notifications
        }
    
    # BGV cleared adds 20 points
    score = state.get("readiness_score", 31) + 20
    events.append(_make_event("BGV", "BGV Agent", "Background verification cleared"))
    notifications.append({"title": "BGV Cleared", "message": "Your background verification has been cleared.", "type": "success"})
    
    return {
        "bgv_status": "cleared",
        "readiness_score": score,
        "timeline_events": events,
        "notifications": notifications
    }

def hr_setup_agent(state: AgentState) -> Dict[str, Any]:
    """HR Setup Agent: Creates employee record."""
    print("--- HR SETUP AGENT ---")
    prov_status = state.get("provisioning_status", {})
    prov_status["hr"] = "completed"
    events = state.get("timeline_events", [])
    notifications = state.get("notifications", [])
    
    # HR setup adds 15 points
    score = state.get("readiness_score", 51) + 15
    events.append(_make_event("HR Setup", "HR Setup Agent", "Employee record created in HRIS"))
    notifications.append({"title": "HR Record Created", "message": "Your employee record has been set up.", "type": "success"})
    
    return {
        "provisioning_status": prov_status,
        "readiness_score": score,
        "timeline_events": events,
        "notifications": notifications
    }

def payroll_setup_agent(state: AgentState) -> Dict[str, Any]:
    """Payroll Setup Agent: Sets up payroll."""
    print("--- PAYROLL SETUP AGENT ---")
    prov_status = state.get("provisioning_status", {})
    prov_status["payroll"] = "completed"
    events = state.get("timeline_events", [])
    notifications = state.get("notifications", [])
    
    # Payroll adds 12 points
    score = state.get("readiness_score", 66) + 12
    events.append(_make_event("Payroll Setup", "Payroll Agent", "Payroll account configured"))
    notifications.append({"title": "Payroll Ready", "message": "Your payroll has been configured.", "type": "success"})
    
    return {
        "provisioning_status": prov_status,
        "readiness_score": score,
        "timeline_events": events,
        "notifications": notifications
    }

def it_provisioning_agent(state: AgentState) -> Dict[str, Any]:
    """IT Provisioning Agent: Allocates IT assets."""
    print("--- IT PROVISIONING AGENT ---")
    prov_status = state.get("provisioning_status", {})
    prov_status["it"] = "completed"
    events = state.get("timeline_events", [])
    notifications = state.get("notifications", [])
    
    events.append(_make_event("IT Provisioning", "IT Agent", "Laptop, email, and tool access provisioned"))
    notifications.append({"title": "IT Ready", "message": "Your laptop and tool access have been provisioned.", "type": "success"})
    
    return {
        "provisioning_status": prov_status,
        "readiness_score": 100,
        "timeline_events": events,
        "notifications": notifications
    }

def readiness_scorer(state: AgentState) -> Dict[str, Any]:
    """Calculates final Day-1 Readiness Score."""
    print("--- READINESS SCORER ---")
    events = state.get("timeline_events", [])
    notifications = state.get("notifications", [])
    
    events.append(_make_event("Ready", "Readiness Scorer", "Day-1 readiness assessment complete — score: 100%"))
    notifications.append({"title": "🎉 You're Ready!", "message": "All onboarding steps are complete. Welcome aboard!", "type": "success"})
    
    return {
        "current_step": "ready",
        "timeline_events": events,
        "notifications": notifications
    }
