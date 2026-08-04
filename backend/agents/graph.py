from langgraph.graph import StateGraph, END
from .state import AgentState
from .nodes import intake_agent, doc_collection_agent, bgv_agent, hr_setup_agent, payroll_setup_agent, it_provisioning_agent, readiness_scorer
from .doc_verification import doc_verification_agent

def create_onboarding_graph():
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("intake", intake_agent)
    workflow.add_node("doc_collection", doc_collection_agent)
    workflow.add_node("doc_verification", doc_verification_agent)
    workflow.add_node("bgv_coordination", bgv_agent)
    workflow.add_node("hr_setup", hr_setup_agent)
    workflow.add_node("payroll_setup", payroll_setup_agent)
    workflow.add_node("it_provisioning", it_provisioning_agent)
    workflow.add_node("readiness_scorer", readiness_scorer)

    # Add edges
    workflow.set_entry_point("intake")
    workflow.add_edge("intake", "doc_collection")
    workflow.add_edge("doc_collection", "doc_verification")

    # Conditional edge from doc_verification
    def route_after_verification(state: AgentState):
        if state.get("requires_hr_review"):
            return END # Halt for manual HR review
        if state.get("missing_documents"):
            return END # Wait for candidate to upload remaining documents
        return "bgv_coordination"

    workflow.add_conditional_edges(
        "doc_verification",
        route_after_verification,
        {
            "bgv_coordination": "bgv_coordination",
            END: END
        }
    )

    workflow.add_edge("bgv_coordination", "hr_setup")
    workflow.add_edge("hr_setup", "payroll_setup")
    workflow.add_edge("payroll_setup", "it_provisioning")
    workflow.add_edge("it_provisioning", "readiness_scorer")
    workflow.add_edge("readiness_scorer", END)

    return workflow.compile()

onboarding_graph = create_onboarding_graph()
