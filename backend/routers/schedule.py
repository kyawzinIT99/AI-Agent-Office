from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from backend.database import get_db
from backend.models_personal import ScheduleEntry

router = APIRouter(prefix="/schedule", tags=["schedule"])


class EntryCreate(BaseModel):
    title:      str
    date:       date
    start_time: str   # "HH:MM"
    end_time:   str
    category:   str = "personal"
    notes:      Optional[str] = None
    recurring:  Optional[str] = None
    task_id:    Optional[int] = None


class EntryUpdate(BaseModel):
    title:      Optional[str] = None
    date:       Optional[date] = None
    start_time: Optional[str] = None
    end_time:   Optional[str] = None
    category:   Optional[str] = None
    notes:      Optional[str] = None
    recurring:  Optional[str] = None


class EntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:         int
    title:      str
    date:       date
    start_time: str
    end_time:   str
    category:   str
    notes:      Optional[str]
    recurring:  Optional[str]
    task_id:    Optional[int]


@router.get("", response_model=list[EntryResponse])
def list_entries(
    date_from: Optional[date] = None,
    date_to:   Optional[date] = None,
    db: Session = Depends(get_db),
):
    q = db.query(ScheduleEntry).order_by(ScheduleEntry.date, ScheduleEntry.start_time)
    if date_from: q = q.filter(ScheduleEntry.date >= date_from)
    if date_to:   q = q.filter(ScheduleEntry.date <= date_to)
    return q.all()


@router.post("", response_model=EntryResponse, status_code=201)
def create_entry(body: EntryCreate, db: Session = Depends(get_db)):
    entry = ScheduleEntry(**body.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=EntryResponse)
def update_entry(entry_id: int, body: EntryUpdate, db: Session = Depends(get_db)):
    e = db.query(ScheduleEntry).filter(ScheduleEntry.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(e, field, val)
    db.commit()
    db.refresh(e)
    return e


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    e = db.query(ScheduleEntry).filter(ScheduleEntry.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(e)
    db.commit()
