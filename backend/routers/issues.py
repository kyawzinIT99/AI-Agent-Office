from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Issue
from backend.schemas import IssueResponse

router = APIRouter(prefix="/issues", tags=["issues"])


@router.get("", response_model=list[IssueResponse])
def get_issues(
    report_id: int | None = Query(None),
    status: str | None = Query(None),
    priority: str | None = Query(None),
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = db.query(Issue).order_by(Issue.updated_at.desc())
    if report_id is not None:
        q = q.filter(Issue.report_id == report_id)
    if status:
        q = q.filter(Issue.status == status)
    if priority:
        q = q.filter(Issue.priority == priority)
    return q.limit(limit).all()
