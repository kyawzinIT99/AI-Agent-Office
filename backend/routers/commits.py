from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Commit
from backend.schemas import CommitResponse

router = APIRouter(prefix="/commits", tags=["commits"])


@router.get("", response_model=list[CommitResponse])
def get_commits(
    report_id: int | None = Query(None),
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(Commit).order_by(Commit.committed_at.desc())
    if report_id is not None:
        q = q.filter(Commit.report_id == report_id)
    return q.limit(limit).all()
