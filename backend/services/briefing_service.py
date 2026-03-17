import logging
from datetime import date
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models_personal import Briefing, PersonalTask, ScheduleEntry

logger = logging.getLogger(__name__)


def _task_to_dict(t: PersonalTask) -> dict:
    return {
        "id": t.id, "title": t.title, "description": t.description,
        "priority": t.priority, "category": t.category, "status": t.status,
        "due_date": str(t.due_date) if t.due_date else None,
        "estimated_minutes": t.estimated_minutes,
    }


def _entry_to_dict(e: ScheduleEntry) -> dict:
    return {
        "id": e.id, "title": e.title, "date": str(e.date),
        "start_time": e.start_time, "end_time": e.end_time,
        "category": e.category, "notes": e.notes,
    }


def run_personal_briefing(briefing_id: int) -> None:
    db: Session = SessionLocal()
    try:
        briefing = db.query(Briefing).filter(Briefing.id == briefing_id).first()
        if not briefing:
            return

        today = date.today()

        # Fetch all non-done tasks
        tasks = db.query(PersonalTask).filter(PersonalTask.status != "done").all()
        tasks_dicts = [_task_to_dict(t) for t in tasks]

        # Fetch today's schedule
        schedule = db.query(ScheduleEntry).filter(ScheduleEntry.date == today).all()
        schedule_dicts = [_entry_to_dict(e) for e in schedule]

        from backend.agents.personal_crew import run_personal_crew
        result = run_personal_crew(
            tasks=tasks_dicts,
            schedule_today=schedule_dicts,
            today=today,
        )

        briefing.planner_output   = result["planner"]
        briefing.scheduler_output = result["scheduler"]
        briefing.coach_output     = result["coach"]
        briefing.combined_output  = result["combined"]
        briefing.status           = "completed"
        db.commit()
        logger.info(f"Briefing {briefing_id} completed.")

    except Exception as e:
        logger.exception(f"Briefing {briefing_id} failed: {e}")
        db.query(Briefing).filter(Briefing.id == briefing_id).update(
            {"status": "failed", "error_message": str(e)}
        )
        db.commit()
    finally:
        db.close()
