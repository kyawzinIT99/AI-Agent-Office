from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CommitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sha: str
    author: str
    message: str
    url: str
    committed_at: Optional[datetime]


class IssueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    jira_key: str
    summary: str
    status: str
    assignee: Optional[str]
    priority: Optional[str]
    issue_type: Optional[str]
    updated_at: Optional[datetime]


class ReportSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    run_date: datetime
    status: str
    pm_summary: Optional[str]


class ReportDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    run_date: datetime
    status: str
    developer_summary: Optional[str]
    qa_summary: Optional[str]
    pm_summary: Optional[str]
    combined_output: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    commits: list[CommitResponse] = []
    issues: list[IssueResponse] = []


class RunResponse(BaseModel):
    status: str
    report_id: int
    message: str


class RunStatusResponse(BaseModel):
    report_id: int
    status: str
    error_message: Optional[str] = None
