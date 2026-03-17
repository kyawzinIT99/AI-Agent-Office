from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.database import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    run_date = Column(DateTime, default=datetime.utcnow, index=True)
    developer_summary = Column(Text, nullable=True)
    qa_summary = Column(Text, nullable=True)
    pm_summary = Column(Text, nullable=True)
    combined_output = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending/running/completed/failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    commits = relationship("Commit", back_populates="report", cascade="all, delete-orphan")
    issues = relationship("Issue", back_populates="report", cascade="all, delete-orphan")
    agent_logs = relationship("AgentLog", back_populates="report", cascade="all, delete-orphan")


class Commit(Base):
    __tablename__ = "commits"

    id = Column(Integer, primary_key=True, index=True)
    sha = Column(String(40), unique=True, index=True)
    author = Column(String(100))
    message = Column(Text)
    url = Column(String(500))
    committed_at = Column(DateTime)
    report_id = Column(Integer, ForeignKey("reports.id"))

    report = relationship("Report", back_populates="commits")


class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    jira_key = Column(String(50), index=True)
    summary = Column(Text)
    status = Column(String(50))
    assignee = Column(String(100), nullable=True)
    priority = Column(String(20), nullable=True)
    issue_type = Column(String(50), nullable=True)
    updated_at = Column(DateTime)
    report_id = Column(Integer, ForeignKey("reports.id"))

    report = relationship("Report", back_populates="issues")


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"))
    agent_role = Column(String(50))
    raw_output = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("Report", back_populates="agent_logs")
