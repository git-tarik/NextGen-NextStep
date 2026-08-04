from typing import TypedDict, List, Dict, Any

class AgentState(TypedDict):
    candidate_id: int
    current_step: str
    candidate_name: str
    candidate_role: str
    documents: List[Dict[str, Any]]
    missing_documents: List[str]
    verification_flags: List[str]
    bgv_status: str
    provisioning_status: Dict[str, str]
    readiness_score: int
    requires_hr_review: bool
    bank_details: Dict[str, str]
    salary_breakdown: Dict[str, Any]
    payslip_pdf_path: str
    timeline_events: List[Dict[str, str]]
    notifications: List[Dict[str, str]]
    compliance_checks: List[Dict[str, Any]]
