from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship
import datetime

Base = declarative_base()

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String, nullable=True)
    role = Column(String)
    department = Column(String, nullable=True)
    start_date = Column(String, nullable=True)
    status = Column(String, default="Intake")
    day_1_readiness_score = Column(Integer, default=0)
    requires_hr_review = Column(Boolean, default=False)
    bgv_status = Column(String, default="pending")
    payroll_status = Column(String, default="pending")
    it_status = Column(String, default="pending")
    hr_status = Column(String, default="pending")
    compliance_status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    documents = relationship("Document", back_populates="candidate")
    status_history = relationship("StatusHistory", back_populates="candidate")
    notifications = relationship("Notification", back_populates="candidate")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"))
    document_type = Column(String) # ID, Degree, Offer Letter
    file_path = Column(String)
    status = Column(String, default="Uploaded") # Uploaded, Verified, Rejected, Flagged
    ocr_extracted_text = Column(Text, nullable=True)
    verification_confidence = Column(Float, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    candidate = relationship("Candidate", back_populates="documents")

class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"))
    previous_status = Column(String, nullable=True)
    new_status = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    notes = Column(String, nullable=True)
    agent = Column(String, nullable=True)  # Which AI agent triggered this

    candidate = relationship("Candidate", back_populates="status_history")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String) # Candidate, Document, System, Agent
    entity_id = Column(Integer, nullable=True)
    action = Column(String)
    details = Column(Text, nullable=True)
    agent_name = Column(String, nullable=True)  # AI Agent that performed the action
    severity = Column(String, default="info")  # info, warning, error, critical
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"))
    title = Column(String)
    message = Column(Text)
    notification_type = Column(String, default="info")  # info, warning, action, success
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    candidate = relationship("Candidate", back_populates="notifications")
