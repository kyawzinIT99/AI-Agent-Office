from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Time, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from backend.database import Base


class PersonalTask(Base):
    __tablename__ = "personal_tasks"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    priority    = Column(String(10), default="medium")   # high / medium / low
    category    = Column(String(30), default="personal") # work / personal / health / learning
    status      = Column(String(20), default="todo")     # todo / in_progress / done / blocked
    due_date    = Column(Date, nullable=True)
    estimated_minutes = Column(Integer, nullable=True)
    notes       = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    schedule_entries = relationship("ScheduleEntry", back_populates="task")


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"

    id         = Column(Integer, primary_key=True, index=True)
    title      = Column(String(200), nullable=False)
    date       = Column(Date, nullable=False, index=True)
    start_time = Column(String(5), nullable=False)   # "HH:MM" 24h
    end_time   = Column(String(5), nullable=False)
    category   = Column(String(30), default="personal")
    notes      = Column(Text, nullable=True)
    recurring  = Column(String(20), nullable=True)   # daily / weekly / none
    task_id    = Column(Integer, ForeignKey("personal_tasks.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("PersonalTask", back_populates="schedule_entries")


class Briefing(Base):
    __tablename__ = "briefings"

    id               = Column(Integer, primary_key=True, index=True)
    briefing_date    = Column(Date, default=datetime.utcnow, index=True)
    status           = Column(String(20), default="pending")
    planner_output   = Column(Text, nullable=True)
    scheduler_output = Column(Text, nullable=True)
    coach_output     = Column(Text, nullable=True)
    combined_output  = Column(Text, nullable=True)
    error_message    = Column(Text, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
