from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from .database import database, models
from .agents.graph import onboarding_graph, post_approval_graph, payroll_graph
from .agents.query_assistant import query_assistant_agent
from .services.vector_store import seed_database
from pydantic import BaseModel
from typing import Optional
import os
import shutil
import datetime

app = FastAPI(title="Onboarding Control Tower API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables (and migrate existing sqlite db with any newly added columns)
database.init_db()

# Ensure upload directory exists
os.makedirs("backend/uploads", exist_ok=True)

# Auto-seed FAQ database on startup
@app.on_event("startup")
def startup_event():
    seed_database()

# --- Pydantic Models ---

class CandidateCreate(BaseModel):
    name: str
    email: str
    role: str
    phone: Optional[str] = None
    department: Optional[str] = None
    start_date: Optional[str] = None

class ChatRequest(BaseModel):
    query: str

class BankDetails(BaseModel):
    account_number: str
    bank_name: str
    pan_number: str

# --- Utility: Audit Logging ---

def log_audit(db: Session, entity_type: str, entity_id: int, action: str, details: str = None, agent_name: str = None, severity: str = "info"):
    """Write an audit log entry."""
    entry = models.AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        details=details,
        agent_name=agent_name,
        severity=severity
    )
    db.add(entry)
    db.commit()

def log_status_change(db: Session, candidate_id: int, old_status: str, new_status: str, notes: str = None, agent: str = None):
    """Record a status change in the history."""
    entry = models.StatusHistory(
        candidate_id=candidate_id,
        previous_status=old_status,
        new_status=new_status,
        notes=notes,
        agent=agent
    )
    db.add(entry)
    db.commit()

def create_notification(db: Session, candidate_id: int, title: str, message: str, notification_type: str = "info"):
    """Create an in-app notification."""
    notif = models.Notification(
        candidate_id=candidate_id,
        title=title,
        message=message,
        notification_type=notification_type
    )
    db.add(notif)
    db.commit()

# --- Root ---

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Onboarding Control Tower API is running"}

# --- Candidate API ---

@app.post("/candidates/")
def create_candidate(candidate_data: CandidateCreate, db: Session = Depends(database.get_db)):
    db_candidate = models.Candidate(
        name=candidate_data.name,
        email=candidate_data.email,
        role=candidate_data.role,
        phone=candidate_data.phone,
        department=candidate_data.department,
        start_date=candidate_data.start_date
    )
    db.add(db_candidate)
    db.commit()
    db.refresh(db_candidate)
    
    # Audit log
    log_audit(db, "Candidate", db_candidate.id, "CREATED", f"New candidate: {candidate_data.name} ({candidate_data.email}) for role {candidate_data.role}")
    
    # Trigger intake agent via LangGraph
    initial_state = {
        "candidate_id": db_candidate.id,
        "current_step": "start",
        "documents": [],
        "missing_documents": [],
        "verification_flags": [],
        "bgv_status": "pending",
        "provisioning_status": {},
        "readiness_score": 0,
        "requires_hr_review": False,
        "timeline_events": [],
        "notifications": [],
        "compliance_checks": []
    }
    
    result_state = onboarding_graph.invoke(initial_state)
    
    old_status = db_candidate.status
    db_candidate.status = result_state.get("current_step", "Intake")
    db_candidate.day_1_readiness_score = result_state.get("readiness_score", 0)
    db_candidate.bgv_status = result_state.get("bgv_status", "pending")
    
    prov = result_state.get("provisioning_status", {})
    db_candidate.hr_status = prov.get("hr", "pending")
    db_candidate.payroll_status = prov.get("payroll", "pending")
    db_candidate.it_status = prov.get("it", "pending")
    
    db.commit()
    
    # Log status change
    log_status_change(db, db_candidate.id, old_status, db_candidate.status, "Initial intake completed", "Intake Agent")
    log_audit(db, "Agent", db_candidate.id, "INTAKE_COMPLETE", f"Intake agent processed candidate. Score: {db_candidate.day_1_readiness_score}", "Intake Agent")
    
    # Create notifications from agent
    for notif in result_state.get("notifications", []):
        create_notification(db, db_candidate.id, notif.get("title", "Update"), notif.get("message", ""), notif.get("type", "info"))

    db.refresh(db_candidate)
    return jsonable_encoder(db_candidate)

@app.get("/candidates/by-email/{email}")
def get_candidate_by_email(email: str, db: Session = Depends(database.get_db)):
    candidate = db.query(models.Candidate).filter(models.Candidate.email == email).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    documents = db.query(models.Document).filter(models.Document.candidate_id == candidate.id).all()
    return {
        "candidate": candidate,
        "documents": documents
    }

@app.get("/candidates/")
def list_candidates(db: Session = Depends(database.get_db)):
    return db.query(models.Candidate).all()

@app.get("/candidates/{candidate_id}")
def get_candidate(candidate_id: int, db: Session = Depends(database.get_db)):
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    documents = db.query(models.Document).filter(models.Document.candidate_id == candidate_id).all()
    
    return {
        "candidate": candidate,
        "documents": documents
    }

# --- Document API ---

@app.post("/candidates/{candidate_id}/documents/")
def upload_document(
    candidate_id: int, 
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db)
):
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    file_location = f"backend/uploads/{candidate_id}_{file.filename}"
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    db_document = models.Document(
        candidate_id=candidate_id,
        document_type=document_type,
        file_path=file_location,
        status="Uploaded"
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    # Audit log
    log_audit(db, "Document", db_document.id, "UPLOADED", f"{document_type} uploaded by candidate {candidate_id}: {file.filename}")
    
    # Load all docs for this candidate to pass to graph
    all_docs = db.query(models.Document).filter(models.Document.candidate_id == candidate_id).all()
    docs_state = []
    for doc in all_docs:
        docs_state.append({
            "id": doc.id,
            "type": doc.document_type,
            "file_path": doc.file_path,
            "status": doc.status
        })
    
    # Run graph to verify and process
    current_state = {
        "candidate_id": candidate_id,
        "current_step": "doc_collection",
        "documents": docs_state,
        "missing_documents": [],
        "verification_flags": [],
        "bgv_status": candidate.bgv_status or "pending",
        "provisioning_status": {
            "hr": candidate.hr_status or "pending",
            "payroll": candidate.payroll_status or "pending",
            "it": candidate.it_status or "pending"
        },
        "readiness_score": candidate.day_1_readiness_score,
        "requires_hr_review": candidate.requires_hr_review,
        "timeline_events": [],
        "notifications": [],
        "compliance_checks": []
    }
    
    result_state = onboarding_graph.invoke(current_state)
    
    # Update candidate based on result
    old_status = candidate.status
    candidate.status = result_state.get("current_step", candidate.status)
    candidate.day_1_readiness_score = result_state.get("readiness_score", candidate.day_1_readiness_score)
    candidate.requires_hr_review = result_state.get("requires_hr_review", candidate.requires_hr_review)
    candidate.bgv_status = result_state.get("bgv_status", candidate.bgv_status)
    
    prov = result_state.get("provisioning_status", {})
    if prov.get("hr"):
        candidate.hr_status = prov["hr"]
    if prov.get("payroll"):
        candidate.payroll_status = prov["payroll"]
    if prov.get("it"):
        candidate.it_status = prov["it"]
    
    # Update compliance
    if candidate.day_1_readiness_score >= 100:
        candidate.compliance_status = "complete"
    elif candidate.requires_hr_review:
        candidate.compliance_status = "review_needed"
    else:
        candidate.compliance_status = "in_progress"
    
    # Update doc statuses from graph result
    for doc_result in result_state.get("documents", []):
        db_doc = db.query(models.Document).filter(models.Document.id == doc_result.get("id")).first()
        if db_doc:
            db_doc.status = doc_result.get("status", db_doc.status)
            if doc_result.get("verification_confidence"):
                db_doc.verification_confidence = doc_result["verification_confidence"]
            
    db.commit()
    
    # Log status change if changed
    if old_status != candidate.status:
        log_status_change(db, candidate_id, old_status, candidate.status, "Document processing triggered status change", "Doc Verification Agent")
    
    log_audit(db, "Agent", candidate_id, "PIPELINE_RUN", f"Agent pipeline executed after document upload. New score: {candidate.day_1_readiness_score}", "Onboarding Graph")
    
    # Create notifications from agent result
    for notif in result_state.get("notifications", []):
        create_notification(db, candidate_id, notif.get("title", "Update"), notif.get("message", ""), notif.get("type", "info"))
    
    return {"message": "Document uploaded and processed", "new_state": result_state}

# --- HR Approval API ---

@app.post("/candidates/{candidate_id}/approve")
def approve_candidate(candidate_id: int, db: Session = Depends(database.get_db)):
    """HR approves a candidate whose documents have been reviewed, resuming the pipeline (BGV -> HR -> Payroll -> IT)."""
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.status != "pending_hr_approval":
        raise HTTPException(status_code=400, detail="Candidate is not awaiting HR approval")

    current_state = {
        "candidate_id": candidate_id,
        "current_step": candidate.status,
        "documents": [],
        "missing_documents": [],
        "verification_flags": [],
        "bgv_status": candidate.bgv_status or "pending",
        "provisioning_status": {
            "hr": candidate.hr_status or "pending",
            "payroll": candidate.payroll_status or "pending",
            "it": candidate.it_status or "pending"
        },
        "readiness_score": candidate.day_1_readiness_score,
        "requires_hr_review": False,
        "timeline_events": [],
        "notifications": [],
        "compliance_checks": []
    }

    result_state = post_approval_graph.invoke(current_state)

    old_status = candidate.status
    candidate.status = result_state.get("current_step", candidate.status)
    candidate.day_1_readiness_score = result_state.get("readiness_score", candidate.day_1_readiness_score)
    candidate.bgv_status = result_state.get("bgv_status", candidate.bgv_status)

    prov = result_state.get("provisioning_status", {})
    if prov.get("hr"):
        candidate.hr_status = prov["hr"]
    if prov.get("payroll"):
        candidate.payroll_status = prov["payroll"]
    if prov.get("it"):
        candidate.it_status = prov["it"]

    candidate.compliance_status = "complete" if candidate.day_1_readiness_score >= 100 else "in_progress"

    db.commit()

    log_status_change(db, candidate_id, old_status, candidate.status, "HR approved onboarding", "HR Approval")
    log_audit(db, "Candidate", candidate_id, "HR_APPROVED", f"HR approved candidate. New score: {candidate.day_1_readiness_score}", "HR Approval")

    for notif in result_state.get("notifications", []):
        create_notification(db, candidate_id, notif.get("title", "Update"), notif.get("message", ""), notif.get("type", "info"))

    return {"message": "Candidate approved", "new_state": result_state}

# --- Payroll API ---

@app.post("/candidates/{candidate_id}/bank-details")
def submit_bank_details(candidate_id: int, details: BankDetails, db: Session = Depends(database.get_db)):
    """Candidate submits bank account & PAN details, resuming the pipeline (Payroll -> IT -> Readiness) and generating a payslip PDF."""
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.status != "payroll_setup":
        raise HTTPException(status_code=400, detail="Candidate is not awaiting payroll bank details")

    candidate.bank_account_number = details.account_number
    candidate.bank_name = details.bank_name
    candidate.pan_number = details.pan_number
    db.commit()

    current_state = {
        "candidate_id": candidate_id,
        "current_step": candidate.status,
        "candidate_name": candidate.name,
        "candidate_role": candidate.role,
        "documents": [],
        "missing_documents": [],
        "verification_flags": [],
        "bgv_status": candidate.bgv_status or "pending",
        "provisioning_status": {
            "hr": candidate.hr_status or "pending",
            "payroll": candidate.payroll_status or "pending",
            "it": candidate.it_status or "pending"
        },
        "readiness_score": candidate.day_1_readiness_score,
        "requires_hr_review": False,
        "bank_details": {
            "account_number": details.account_number,
            "bank_name": details.bank_name,
            "pan_number": details.pan_number
        },
        "timeline_events": [],
        "notifications": [],
        "compliance_checks": []
    }

    result_state = payroll_graph.invoke(current_state)

    old_status = candidate.status
    candidate.status = result_state.get("current_step", candidate.status)
    candidate.day_1_readiness_score = result_state.get("readiness_score", candidate.day_1_readiness_score)

    prov = result_state.get("provisioning_status", {})
    if prov.get("hr"):
        candidate.hr_status = prov["hr"]
    if prov.get("payroll"):
        candidate.payroll_status = prov["payroll"]
    if prov.get("it"):
        candidate.it_status = prov["it"]

    if result_state.get("payslip_pdf_path"):
        candidate.payslip_pdf_path = result_state["payslip_pdf_path"]

    candidate.compliance_status = "complete" if candidate.day_1_readiness_score >= 100 else "in_progress"

    db.commit()

    log_status_change(db, candidate_id, old_status, candidate.status, "Candidate submitted bank details; payroll finalized", "Payroll Agent")
    log_audit(db, "Candidate", candidate_id, "BANK_DETAILS_SUBMITTED", f"Bank details submitted and payslip generated for candidate {candidate_id}", "Payroll Agent")

    for notif in result_state.get("notifications", []):
        create_notification(db, candidate_id, notif.get("title", "Update"), notif.get("message", ""), notif.get("type", "info"))

    return {"message": "Bank details submitted and payroll finalized", "new_state": result_state}

@app.get("/candidates/{candidate_id}/payslip")
def download_payslip(candidate_id: int, db: Session = Depends(database.get_db)):
    """Download the generated payslip PDF for a candidate."""
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if not candidate.payslip_pdf_path or not os.path.exists(candidate.payslip_pdf_path):
        raise HTTPException(status_code=404, detail="Payslip not yet generated")

    safe_name = candidate.name.replace(" ", "_") if candidate.name else str(candidate_id)
    return FileResponse(
        candidate.payslip_pdf_path,
        media_type="application/pdf",
        filename=f"payslip_{safe_name}.pdf"
    )

# --- Timeline API ---

@app.get("/candidates/{candidate_id}/timeline")
def get_candidate_timeline(candidate_id: int, db: Session = Depends(database.get_db)):
    """Get the status change history for a candidate."""
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    history = db.query(models.StatusHistory).filter(
        models.StatusHistory.candidate_id == candidate_id
    ).order_by(models.StatusHistory.timestamp.asc()).all()
    
    return [
        {
            "id": h.id,
            "previous_status": h.previous_status,
            "new_status": h.new_status,
            "timestamp": h.timestamp.isoformat() if h.timestamp else None,
            "notes": h.notes,
            "agent": h.agent
        }
        for h in history
    ]

# --- Notification API ---

@app.get("/notifications/{candidate_id}")
def get_notifications(candidate_id: int, db: Session = Depends(database.get_db)):
    """Get all notifications for a candidate."""
    notifs = db.query(models.Notification).filter(
        models.Notification.candidate_id == candidate_id
    ).order_by(models.Notification.created_at.desc()).all()
    
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.notification_type,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None
        }
        for n in notifs
    ]

@app.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(database.get_db)):
    """Mark a notification as read."""
    notif = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"status": "ok"}

# --- Audit Log API ---

@app.get("/audit-logs/")
def get_audit_logs(limit: int = 50, db: Session = Depends(database.get_db)):
    """Get audit log entries for compliance tracking."""
    logs = db.query(models.AuditLog).order_by(
        models.AuditLog.timestamp.desc()
    ).limit(limit).all()
    
    return [
        {
            "id": l.id,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "action": l.action,
            "details": l.details,
            "agent_name": l.agent_name,
            "severity": l.severity,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None
        }
        for l in logs
    ]

# --- Metrics API ---

@app.get("/metrics/")
def get_metrics(db: Session = Depends(database.get_db)):
    """Get success metrics for the HR dashboard."""
    candidates = db.query(models.Candidate).all()
    total = len(candidates)
    
    if total == 0:
        return {
            "total_candidates": 0,
            "day1_ready_count": 0,
            "day1_ready_rate": 0,
            "avg_readiness_score": 0,
            "pending_reviews": 0,
            "avg_cycle_time_hours": 0,
            "docs_uploaded": 0,
            "docs_verified": 0,
            "docs_flagged": 0,
            "bgv_cleared": 0,
            "bgv_pending": 0,
            "it_provisioned": 0,
            "payroll_setup": 0
        }
    
    day1_ready = [c for c in candidates if c.day_1_readiness_score >= 100]
    pending_reviews = [c for c in candidates if c.requires_hr_review]
    avg_score = sum(c.day_1_readiness_score for c in candidates) / total
    
    # Calculate avg cycle time (hours from creation to now, or to completion)
    now = datetime.datetime.utcnow()
    cycle_times = []
    for c in candidates:
        if c.created_at:
            delta = now - c.created_at
            cycle_times.append(delta.total_seconds() / 3600)
    avg_cycle = sum(cycle_times) / len(cycle_times) if cycle_times else 0
    
    # Document metrics
    all_docs = db.query(models.Document).all()
    docs_verified = len([d for d in all_docs if d.status and d.status.lower() not in ("uploaded", "flagged", "rejected")])
    docs_flagged = len([d for d in all_docs if d.status and d.status.lower() in ("flagged", "rejected")])
    
    # Provisioning metrics
    bgv_cleared = len([c for c in candidates if c.bgv_status == "cleared"])
    bgv_pending = len([c for c in candidates if c.bgv_status == "pending"])
    it_provisioned = len([c for c in candidates if c.it_status == "completed"])
    payroll_setup = len([c for c in candidates if c.payroll_status == "completed"])
    
    return {
        "total_candidates": total,
        "day1_ready_count": len(day1_ready),
        "day1_ready_rate": round(len(day1_ready) / total * 100, 1) if total > 0 else 0,
        "avg_readiness_score": round(avg_score, 1),
        "pending_reviews": len(pending_reviews),
        "avg_cycle_time_hours": round(avg_cycle, 1),
        "docs_uploaded": len(all_docs),
        "docs_verified": docs_verified,
        "docs_flagged": docs_flagged,
        "bgv_cleared": bgv_cleared,
        "bgv_pending": bgv_pending,
        "it_provisioned": it_provisioned,
        "payroll_setup": payroll_setup
    }

# --- Chat API ---
    
@app.post("/chat/")
def chat(request: ChatRequest):
    response = query_assistant_agent(request.query)
    return {"response": response}

# --- FAQ Reseed ---

@app.post("/admin/reseed-faq")
def reseed_faq():
    """Force reseed the FAQ database."""
    from .services.vector_store import reseed_database
    reseed_database()
    return {"status": "ok", "message": "FAQ database reseeded"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
