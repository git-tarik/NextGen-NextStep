from typing import TypedDict, List, Dict, Any

class AgentState(TypedDict):
    candidate_id: int
    current_step: str
    documents: List[Dict[str, Any]]
    missing_documents: List[str]
    verification_flags: List[str]
    bgv_status: str
    provisioning_status: Dict[str, str]
    readiness_score: int
    requires_hr_review: bool
    timeline_events: List[Dict[str, str]]
    notifications: List[Dict[str, str]]
    compliance_checks: List[Dict[str, Any]]
