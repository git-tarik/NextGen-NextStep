from langgraph.graph import StateGraph, END
from .state import AgentState
from .nodes import intake_agent, doc_collection_agent, bgv_agent, hr_setup_agent, payroll_setup_agent, it_provisioning_agent, readiness_scorer
from .doc_verification import doc_verification_agent

def create_onboarding_graph():
    """Intake through document verification. Halts at pending_hr_approval — HR must approve before BGV/HR/Payroll/IT run."""
    workflow = StateGraph(AgentState)

    workflow.add_node("intake", intake_agent)
    workflow.add_node("doc_collection", doc_collection_agent)
    workflow.add_node("doc_verification", doc_verification_agent)

    workflow.set_entry_point("intake")
    workflow.add_edge("intake", "doc_collection")
    workflow.add_edge("doc_collection", "doc_verification")
    workflow.add_edge("doc_verification", END)

    return workflow.compile()

def create_post_approval_graph():
    """BGV through HR record setup. Triggered by HR clicking Approve.
    Halts at payroll_setup — candidate must submit bank details before payroll/IT/readiness run."""
    workflow = StateGraph(AgentState)

    workflow.add_node("bgv_coordination", bgv_agent)
    workflow.add_node("hr_setup", hr_setup_agent)

    workflow.set_entry_point("bgv_coordination")
    workflow.add_edge("bgv_coordination", "hr_setup")
    workflow.add_edge("hr_setup", END)

    return workflow.compile()

def create_payroll_graph():
    """Payroll setup through readiness scoring. Triggered once the candidate submits bank details."""
    workflow = StateGraph(AgentState)

    workflow.add_node("payroll_setup", payroll_setup_agent)
    workflow.add_node("it_provisioning", it_provisioning_agent)
    workflow.add_node("readiness_scorer", readiness_scorer)

    workflow.set_entry_point("payroll_setup")
    workflow.add_edge("payroll_setup", "it_provisioning")
    workflow.add_edge("it_provisioning", "readiness_scorer")
    workflow.add_edge("readiness_scorer", END)

    return workflow.compile()

onboarding_graph = create_onboarding_graph()
post_approval_graph = create_post_approval_graph()
payroll_graph = create_payroll_graph()
