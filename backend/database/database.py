from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./onboarding.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
    run_light_migrations()

def run_light_migrations():
    """Add newly introduced columns to an existing sqlite db without dropping data."""
    if engine.dialect.name != "sqlite":
        return
    new_columns = {
        "bank_account_number": "VARCHAR",
        "bank_name": "VARCHAR",
        "pan_number": "VARCHAR",
        "payslip_pdf_path": "VARCHAR",
    }
    with engine.connect() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(candidates)")}
        for column, col_type in new_columns.items():
            if column not in existing:
                conn.exec_driver_sql(f"ALTER TABLE candidates ADD COLUMN {column} {col_type}")
        conn.commit()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
