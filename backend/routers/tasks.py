from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from backend.database import get_db
from backend.models_personal import PersonalTask

router = APIRouter(prefix="/tasks", tags=["personal-tasks"])


# ── Schemas ──────────────────────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title:       str
    description: Optional[str] = None
    priority:    str = "medium"
    category:    str = "personal"
    status:      str = "todo"
    due_date:    Optional[date] = None
    estimated_minutes: Optional[int] = None
    notes:       Optional[str] = None


class TaskUpdate(BaseModel):
    title:       Optional[str] = None
    description: Optional[str] = None
    priority:    Optional[str] = None
    category:    Optional[str] = None
    status:      Optional[str] = None
    due_date:    Optional[date] = None
    estimated_minutes: Optional[int] = None
    notes:       Optional[str] = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:          int
    title:       str
    description: Optional[str]
    priority:    str
    category:    str
    status:      str
    due_date:    Optional[date]
    estimated_minutes: Optional[int]
    notes:       Optional[str]
    created_at:  str
    updated_at:  str

    @classmethod
    def from_orm_safe(cls, t: PersonalTask) -> "TaskResponse":
        return cls(
            id=t.id, title=t.title, description=t.description,
            priority=t.priority, category=t.category, status=t.status,
            due_date=t.due_date, estimated_minutes=t.estimated_minutes,
            notes=t.notes,
            created_at=t.created_at.isoformat(),
            updated_at=t.updated_at.isoformat() if t.updated_at else t.created_at.isoformat(),
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("", response_model=list[TaskResponse])
def list_tasks(
    status:   Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(PersonalTask).order_by(PersonalTask.due_date.asc().nullslast(), PersonalTask.priority)
    if status:   q = q.filter(PersonalTask.status == status)
    if category: q = q.filter(PersonalTask.category == category)
    if priority: q = q.filter(PersonalTask.priority == priority)
    return [TaskResponse.from_orm_safe(t) for t in q.all()]


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    task = PersonalTask(**body.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskResponse.from_orm_safe(task)


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(PersonalTask).filter(PersonalTask.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse.from_orm_safe(t)


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, body: TaskUpdate, db: Session = Depends(get_db)):
    t = db.query(PersonalTask).filter(PersonalTask.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(t, field, val)
    db.commit()
    db.refresh(t)
    return TaskResponse.from_orm_safe(t)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(PersonalTask).filter(PersonalTask.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(t)
    db.commit()
