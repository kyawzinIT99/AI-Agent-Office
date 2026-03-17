import threading
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from backend.database import get_db
from backend.models_personal import Briefing

router = APIRouter(prefix="/briefing", tags=["briefing"])


class BriefingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:               int
    briefing_date:    date
    status:           str
    planner_output:   str | None
    scheduler_output: str | None
    coach_output:     str | None
    combined_output:  str | None
    error_message:    str | None


@router.get("/latest", response_model=BriefingResponse)
def latest_briefing(db: Session = Depends(get_db)):
    b = db.query(Briefing).filter(Briefing.status == "completed") \
        .order_by(Briefing.briefing_date.desc()).first()
    if not b:
        raise HTTPException(status_code=404, detail="No briefings yet")
    return b


@router.get("", response_model=list[BriefingResponse])
def list_briefings(db: Session = Depends(get_db)):
    return db.query(Briefing).order_by(Briefing.briefing_date.desc()).limit(30).all()


@router.post("/run", status_code=202)
def run_briefing(db: Session = Depends(get_db)):
    b = Briefing(status="running", briefing_date=date.today())
    db.add(b)
    db.commit()
    db.refresh(b)
    briefing_id = b.id

    def _run():
        from backend.services.briefing_service import run_personal_briefing
        run_personal_briefing(briefing_id)

    threading.Thread(target=_run, daemon=True).start()
    return {"status": "started", "briefing_id": briefing_id}


@router.get("/status/{briefing_id}")
def briefing_status(briefing_id: int, db: Session = Depends(get_db)):
    b = db.query(Briefing).filter(Briefing.id == briefing_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    return {"briefing_id": b.id, "status": b.status, "error_message": b.error_message}
