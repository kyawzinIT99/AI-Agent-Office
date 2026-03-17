from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas import ReportDetail, ReportSummary
from backend.services.report_service import get_report, get_latest_report, list_reports

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/latest", response_model=ReportDetail)
def latest_report(db: Session = Depends(get_db)):
    report = get_latest_report(db)
    if not report:
        raise HTTPException(status_code=404, detail="No completed reports found")
    return report


@router.get("", response_model=list[ReportSummary])
def get_reports(page: int = 1, limit: int = 20, db: Session = Depends(get_db)):
    return list_reports(db, page=page, limit=limit)


@router.get("/{report_id}", response_model=ReportDetail)
def get_report_by_id(report_id: int, db: Session = Depends(get_db)):
    report = get_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
