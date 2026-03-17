import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db, SessionLocal
from backend.models import Report
from backend.schemas import RunResponse, RunStatusResponse
from backend.services import report_service

router = APIRouter(prefix="/run", tags=["run"])

_active_runs: set[int] = set()


def _run_in_background(report_id: int) -> None:
    """Run report_service in a thread (report row already created)."""
    try:
        report_service.run_and_persist_with_id(report_id)
    finally:
        _active_runs.discard(report_id)


@router.post("/now", response_model=RunResponse)
def trigger_run(db: Session = Depends(get_db)):
    # Create a placeholder report immediately
    report = Report(status="running")
    db.add(report)
    db.commit()
    db.refresh(report)
    report_id = report.id

    _active_runs.add(report_id)
    thread = threading.Thread(target=_run_in_background, args=(report_id,), daemon=True)
    thread.start()

    return RunResponse(
        status="started",
        report_id=report_id,
        message=f"Agent crew started. Poll /api/run/status/{report_id} for progress.",
    )


@router.get("/status/{report_id}", response_model=RunStatusResponse)
def run_status(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return RunStatusResponse(
        report_id=report.id,
        status=report.status,
        error_message=report.error_message,
    )
