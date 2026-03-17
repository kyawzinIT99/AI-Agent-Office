# AI Agent Office — Complete Build Guide

A full-stack multi-agent system where an AI engineering team (Developer, QA, Product Manager) autonomously reads your GitHub commits and Jira issues, writes structured daily reports, and simulates working in a visual office. Includes a personal productivity layer (Planner, Scheduler, Coach) that reads your real tasks and calendar to generate a personalised daily briefing — with live voice narration entirely in the browser.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Project Structure](#3-project-structure)
4. [Environment Setup](#4-environment-setup)
5. [Backend — Python / FastAPI](#5-backend--python--fastapi)
   - 5.1 [config.py](#51-configpy)
   - 5.2 [database.py](#52-databasepy)
   - 5.3 [models.py](#53-modelspy)
   - 5.4 [models_personal.py](#54-models_personalpy)
   - 5.5 [schemas.py](#55-schemaspy)
   - 5.6 [main.py](#56-mainpy)
   - 5.7 [scheduler.py](#57-schedulerpy)
   - 5.8 [Tools](#58-tools)
   - 5.9 [Services](#59-services)
   - 5.10 [Engineering Agents & Crew](#510-engineering-agents--crew)
   - 5.11 [Personal Agents & Crew](#511-personal-agents--crew)
   - 5.12 [Routers](#512-routers)
6. [Frontend — React / TypeScript / Phaser](#6-frontend--react--typescript--phaser)
   - 6.1 [package.json](#61-packagejson)
   - 6.2 [vite.config.ts](#62-viteconfigts)
   - 6.3 [postcss.config.js](#63-postcssconfigjs)
   - 6.4 [index.css](#64-indexcss)
   - 6.5 [API Clients](#65-api-clients)
   - 6.6 [Hooks](#66-hooks)
   - 6.7 [App.tsx & Navbar](#67-apptsx--navbar)
   - 6.8 [Voice Engine](#68-voice-engine)
   - 6.9 [Pages](#69-pages)
7. [start.sh — One-Command Startup](#7-startsh--one-command-startup)
8. [Running the System](#8-running-the-system)
9. [API Reference](#9-api-reference)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React + Vite)                   │
│                                                                  │
│  Dashboard  │  Office Sim  │  Briefing  │  Tasks  │  Schedule  │
│             │  (Phaser 3)  │            │         │            │
│             │  Voice       │                                    │
│             │  (Web Speech │                                    │
│             │   API)       │                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / REST (localhost:8000)
┌────────────────────────────▼────────────────────────────────────┐
│                     FastAPI Backend                              │
│                                                                  │
│  ┌─────────────────────────┐   ┌────────────────────────────┐   │
│  │   Engineering Workflow  │   │   Personal Productivity    │   │
│  │                         │   │                            │   │
│  │  Developer Agent        │   │  Planner Agent             │   │
│  │   └─ GitHub Tool        │   │  Scheduler Agent           │   │
│  │  QA Agent               │   │  Coach Agent               │   │
│  │   └─ Jira Tool          │   │                            │   │
│  │  PM Agent               │   │  Reads: Tasks + Schedule   │   │
│  │   └─ Jira Tool          │   │  Writes: Briefing          │   │
│  │                         │   │                            │   │
│  │  CrewAI (sequential)    │   │  CrewAI (sequential)       │   │
│  │  GPT-4o-mini            │   │  GPT-4o-mini               │   │
│  └─────────────────────────┘   └────────────────────────────┘   │
│                                                                  │
│  APScheduler (daily auto-run)                                    │
│  SQLite via SQLAlchemy 2.0                                       │
└─────────────────────────────────────────────────────────────────┘
         │                              │
    GitHub REST API              Jira REST API v3
```

**Data flow — Engineering run:**
1. Cron fires at 09:00 UTC (or user presses "Run Now")
2. GitHub commits fetched for last 24 h
3. Jira issues fetched for last 24 h
4. Data injected as pre-fetched text into three CrewAI agent tools
5. Sequential crew runs: Developer → QA → PM
6. Each agent produces a markdown section
7. Report row written to SQLite, status polled by frontend

**Data flow — Personal briefing:**
1. User presses "Generate Briefing"
2. All non-done tasks + today's schedule fetched from DB
3. Personal crew runs: Planner → Scheduler → Coach
4. Briefing row written to SQLite
5. Frontend renders each panel with a per-panel Read button (Web Speech API)

---

## 2. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | `python3 --version` |
| Node.js | 20+ | `node --version` |
| npm | 10+ | bundled with Node |
| Git | any | for cloning |
| OpenAI API key | — | gpt-4o-mini calls |
| GitHub Personal Access Token | — | `repo` scope |
| Jira API token | optional | skip if no Jira |

---

## 3. Project Structure

```
AI agent Office/
├── .env                       ← your credentials (never commit)
├── .env.example               ← template
├── .gitignore
├── start.sh                   ← one-command startup
├── database/
│   └── agentoffice.db         ← auto-created on first run
├── backend/
│   ├── __init__.py
│   ├── requirements.txt
│   ├── config.py              ← Pydantic settings
│   ├── database.py            ← SQLAlchemy engine + init_db()
│   ├── models.py              ← Report, Commit, Issue, AgentLog
│   ├── models_personal.py     ← PersonalTask, ScheduleEntry, Briefing
│   ├── schemas.py             ← Pydantic v2 response schemas
│   ├── main.py                ← FastAPI app + lifespan + CORS
│   ├── scheduler.py           ← APScheduler daily cron
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── crew.py            ← Engineering crew orchestration
│   │   ├── developer_agent.py
│   │   ├── qa_agent.py
│   │   ├── pm_agent.py
│   │   ├── personal_crew.py   ← Personal crew orchestration
│   │   ├── planner_agent.py
│   │   ├── scheduler_agent.py
│   │   └── coach_agent.py
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── github_tool.py     ← BaseTool wrapping GitHub service
│   │   └── jira_tool.py       ← BaseTool wrapping Jira service
│   ├── services/
│   │   ├── __init__.py
│   │   ├── github_service.py  ← httpx GitHub REST calls
│   │   ├── jira_service.py    ← requests Jira REST calls
│   │   ├── report_service.py  ← run_and_persist logic
│   │   └── briefing_service.py← run_personal_briefing logic
│   └── routers/
│       ├── __init__.py
│       ├── reports.py         ← GET /api/reports
│       ├── commits.py         ← GET /api/commits
│       ├── issues.py          ← GET /api/issues
│       ├── run.py             ← POST /api/run/now
│       ├── tasks.py           ← CRUD /api/tasks
│       ├── schedule.py        ← CRUD /api/schedule
│       └── briefing.py        ← POST /api/briefing/run
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── postcss.config.js
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── api/
        │   ├── client.ts          ← engineering API calls
        │   └── personalClient.ts  ← tasks/schedule/briefing calls
        ├── hooks/
        │   ├── usePolling.ts      ← generic interval fetcher
        │   └── useRunStatus.ts    ← polls run/briefing status
        ├── components/
        │   ├── Navbar.tsx
        │   ├── RunNowButton.tsx
        │   └── StatusBadge.tsx
        ├── office/
        │   ├── OfficeScene.ts     ← Phaser 3 simulation
        │   └── voice.ts           ← Web Speech API wrapper
        └── pages/
            ├── Dashboard.tsx
            ├── OfficePage.tsx
            ├── BriefingPage.tsx
            ├── TasksPage.tsx
            ├── SchedulePage.tsx
            ├── ReportsHistory.tsx
            ├── ReportDetailPage.tsx
            ├── CommitsPage.tsx
            └── IssuesPage.tsx
```

---

## 4. Environment Setup

Create `.env` in the project root (same level as `start.sh`):

```bash
# ── OpenAI (required) ─────────────────────────────────────────────
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# ── GitHub (required for commit feed) ─────────────────────────────
GITHUB_TOKEN=ghp_YOUR_TOKEN_HERE
GITHUB_REPO=yourname/yourrepo          # e.g.  octocat/Hello-World

# ── Jira (optional — leave placeholder to skip gracefully) ────────
JIRA_SERVER=https://your-domain.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=YOUR_JIRA_TOKEN
JIRA_PROJECT_KEY=ENG

# ── Database ───────────────────────────────────────────────────────
DATABASE_URL=sqlite:///./database/agentoffice.db

# ── Scheduler (UTC 24 h) ──────────────────────────────────────────
SCHEDULER_HOUR=9
SCHEDULER_MINUTE=0
```

> **Jira is optional.** If `JIRA_SERVER` still contains `your-domain.atlassian.net`, the service silently returns an empty list and agents work on GitHub data only.

---

## 5. Backend — Python / FastAPI

### 5.1 `config.py`

```python
# backend/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openai_api_key: str = ""
    github_token: str = ""
    github_repo: str = "owner/repo"
    jira_server: str = ""
    jira_email: str = ""
    jira_api_token: str = ""
    jira_project_key: str = "ENG"
    database_url: str = "sqlite:///./database/agentoffice.db"
    scheduler_hour: int = 9
    scheduler_minute: int = 0

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

### 5.2 `database.py`

```python
# backend/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from backend.config import get_settings

settings = get_settings()

db_path = settings.database_url.replace("sqlite:///", "")
os.makedirs(os.path.dirname(db_path), exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Import every model module before create_all so SQLAlchemy sees them."""
    import backend.models           # noqa: F401
    import backend.models_personal  # noqa: F401
    Base.metadata.create_all(bind=engine)
```

### 5.3 `models.py`

```python
# backend/models.py
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base


class Report(Base):
    __tablename__ = "reports"
    id                = Column(Integer, primary_key=True, index=True)
    run_date          = Column(DateTime, default=datetime.utcnow, index=True)
    developer_summary = Column(Text, nullable=True)
    qa_summary        = Column(Text, nullable=True)
    pm_summary        = Column(Text, nullable=True)
    combined_output   = Column(Text, nullable=True)
    status            = Column(String(20), default="pending")  # pending/running/completed/failed
    error_message     = Column(Text, nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)

    commits    = relationship("Commit",   back_populates="report", cascade="all, delete-orphan")
    issues     = relationship("Issue",    back_populates="report", cascade="all, delete-orphan")
    agent_logs = relationship("AgentLog", back_populates="report", cascade="all, delete-orphan")


class Commit(Base):
    __tablename__ = "commits"
    id           = Column(Integer, primary_key=True, index=True)
    sha          = Column(String(40), unique=True, index=True)
    author       = Column(String(100))
    message      = Column(Text)
    url          = Column(String(500))
    committed_at = Column(DateTime)
    report_id    = Column(Integer, ForeignKey("reports.id"))
    report       = relationship("Report", back_populates="commits")


class Issue(Base):
    __tablename__ = "issues"
    id          = Column(Integer, primary_key=True, index=True)
    jira_key    = Column(String(50), index=True)
    summary     = Column(Text)
    status      = Column(String(50))
    assignee    = Column(String(100), nullable=True)
    priority    = Column(String(20), nullable=True)
    issue_type  = Column(String(50), nullable=True)
    updated_at  = Column(DateTime)
    report_id   = Column(Integer, ForeignKey("reports.id"))
    report      = relationship("Report", back_populates="issues")


class AgentLog(Base):
    __tablename__ = "agent_logs"
    id         = Column(Integer, primary_key=True, index=True)
    report_id  = Column(Integer, ForeignKey("reports.id"))
    agent_role = Column(String(50))
    raw_output = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    report     = relationship("Report", back_populates="agent_logs")
```

### 5.4 `models_personal.py`

```python
# backend/models_personal.py
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base


class PersonalTask(Base):
    __tablename__ = "personal_tasks"
    id                = Column(Integer, primary_key=True, index=True)
    title             = Column(String(200), nullable=False)
    description       = Column(Text, nullable=True)
    priority          = Column(String(10), default="medium")    # high/medium/low
    category          = Column(String(30), default="personal")  # work/personal/health/learning
    status            = Column(String(20), default="todo")      # todo/in_progress/done/blocked
    due_date          = Column(Date, nullable=True)
    estimated_minutes = Column(Integer, nullable=True)
    notes             = Column(Text, nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    schedule_entries = relationship("ScheduleEntry", back_populates="task")


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"
    id         = Column(Integer, primary_key=True, index=True)
    title      = Column(String(200), nullable=False)
    date       = Column(Date, nullable=False, index=True)
    start_time = Column(String(5), nullable=False)   # "HH:MM" 24 h
    end_time   = Column(String(5), nullable=False)
    category   = Column(String(30), default="personal")
    notes      = Column(Text, nullable=True)
    recurring  = Column(String(20), nullable=True)   # daily/weekly/none
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
```

### 5.5 `schemas.py`

```python
# backend/schemas.py
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
```

### 5.6 `main.py`

```python
# backend/main.py
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import init_db
from backend.routers import reports, commits, issues, run, tasks, schedule, briefing
from backend.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()                    # creates all tables on first boot
    logger.info("Database ready.")
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="AI Agent Office",
    description="Multi-agent engineering team simulation with GitHub + Jira integration",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router,  prefix="/api")
app.include_router(commits.router,  prefix="/api")
app.include_router(issues.router,   prefix="/api")
app.include_router(run.router,      prefix="/api")
app.include_router(tasks.router,    prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(briefing.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AI Agent Office"}
```

### 5.7 `scheduler.py`

```python
# backend/scheduler.py
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from backend.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

scheduler = BackgroundScheduler()


def _scheduled_run():
    from backend.services.report_service import run_and_persist
    logger.info("Scheduled crew run starting...")
    run_and_persist()


def start_scheduler():
    scheduler.add_job(
        _scheduled_run,
        trigger=CronTrigger(
            hour=settings.scheduler_hour,
            minute=settings.scheduler_minute,
        ),
        id="daily_crew_run",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        f"Scheduler started — daily run at "
        f"{settings.scheduler_hour:02d}:{settings.scheduler_minute:02d} UTC"
    )


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
```

### 5.8 Tools

#### `backend/tools/github_tool.py`

```python
from crewai.tools import BaseTool
from pydantic import Field
from backend.services.github_service import fetch_recent_commits, format_commits_for_llm


class GitHubCommitsTool(BaseTool):
    name: str = "GitHub Commits Fetcher"
    description: str = (
        "Fetches recent Git commits from the configured GitHub repository "
        "for the last 24 hours. Returns author, SHA, and message for each commit."
    )
    # Data pre-fetched before crew starts to avoid redundant API calls
    prefetched_data: str = Field(default="", exclude=True)

    def _run(self, query: str = "") -> str:
        if self.prefetched_data:
            return self.prefetched_data
        commits = fetch_recent_commits()
        return format_commits_for_llm(commits)
```

#### `backend/tools/jira_tool.py`

```python
from crewai.tools import BaseTool
from pydantic import Field
from backend.services.jira_service import fetch_recent_issues, format_issues_for_llm


class JiraIssuesTool(BaseTool):
    name: str = "Jira Issues Fetcher"
    description: str = (
        "Fetches recent Jira issues updated in the last 24 hours. "
        "Returns key, type, status, assignee, and priority for each issue."
    )
    prefetched_data: str = Field(default="", exclude=True)

    def _run(self, query: str = "") -> str:
        if self.prefetched_data:
            return self.prefetched_data
        issues = fetch_recent_issues()
        return format_issues_for_llm(issues)
```

### 5.9 Services

#### `backend/services/github_service.py`

```python
from datetime import datetime, timedelta, timezone
from typing import Any
import logging
import httpx
from backend.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
GITHUB_API = "https://api.github.com"


def _headers() -> dict:
    return {
        "Authorization": f"token {settings.github_token.strip()}",
        "Accept": "application/vnd.github.v3+json",
    }


def fetch_recent_commits(since_hours: int = 24) -> list[dict[str, Any]]:
    if not settings.github_token.strip() or "/" not in settings.github_repo:
        logger.warning("GitHub not configured — skipping.")
        return []

    since = datetime.now(timezone.utc) - timedelta(hours=since_hours)
    owner, repo = settings.github_repo.split("/", 1)
    url = f"{GITHUB_API}/repos/{owner}/{repo}/commits"
    params: dict = {"since": since.strftime("%Y-%m-%dT%H:%M:%SZ"), "per_page": 100}
    commits: list[dict[str, Any]] = []

    try:
        with httpx.Client(timeout=30) as client:
            while url:
                resp = client.get(url, headers=_headers(), params=params)
                if resp.status_code == 404:
                    logger.warning(f"GitHub repo '{settings.github_repo}' not found.")
                    return []
                resp.raise_for_status()
                for c in resp.json():
                    commits.append({
                        "sha": c["sha"],
                        "author": c["commit"]["author"].get("name", "unknown"),
                        "message": c["commit"]["message"].split("\n")[0],
                        "url": c["html_url"],
                        "committed_at": c["commit"]["author"].get("date"),
                    })
                link = resp.headers.get("Link", "")
                url = ""
                params = {}
                if 'rel="next"' in link:
                    for part in link.split(","):
                        if 'rel="next"' in part:
                            url = part.split(";")[0].strip().strip("<>")
    except Exception as e:
        logger.warning(f"GitHub fetch failed: {e}")

    return commits


def format_commits_for_llm(commits: list[dict]) -> str:
    if not commits:
        return "No commits in the last 24 hours."
    lines = [f"- [{c['sha'][:7]}] {c['author']}: {c['message']}" for c in commits]
    return f"Recent commits ({len(commits)} total):\n" + "\n".join(lines)
```

#### `backend/services/jira_service.py`

```python
from datetime import datetime, timedelta, timezone
from typing import Any
import logging
import requests
from requests.auth import HTTPBasicAuth
from backend.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
_PLACEHOLDER = "your-domain.atlassian.net"


def _is_configured() -> bool:
    return (
        settings.jira_server
        and _PLACEHOLDER not in settings.jira_server
        and settings.jira_api_token.strip()
        and settings.jira_email.strip()
    )


def _auth():  return HTTPBasicAuth(settings.jira_email, settings.jira_api_token)
def _headers(): return {"Accept": "application/json", "Content-Type": "application/json"}


def fetch_recent_issues(since_hours: int = 24) -> list[dict[str, Any]]:
    if not _is_configured():
        logger.warning("Jira not configured — skipping.")
        return []

    since_str = (datetime.now(timezone.utc) - timedelta(hours=since_hours)).strftime("%Y-%m-%d")
    jql = (
        f'project = "{settings.jira_project_key}" '
        f'AND updated >= "{since_str}" ORDER BY updated DESC'
    )
    url = f"{settings.jira_server}/rest/api/3/search"
    params: dict = {
        "jql": jql, "maxResults": 100,
        "fields": "summary,status,assignee,priority,issuetype,updated",
    }
    issues: list[dict[str, Any]] = []
    start = 0
    try:
        while True:
            params["startAt"] = start
            resp = requests.get(url, headers=_headers(), auth=_auth(), params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            for issue in data.get("issues", []):
                fields = issue["fields"]
                issues.append({
                    "jira_key":   issue["key"],
                    "summary":    fields.get("summary", ""),
                    "status":     (fields.get("status") or {}).get("name", "Unknown"),
                    "assignee":   (fields.get("assignee") or {}).get("displayName"),
                    "priority":   (fields.get("priority") or {}).get("name"),
                    "issue_type": (fields.get("issuetype") or {}).get("name"),
                    "updated_at": fields.get("updated"),
                })
            total = data.get("total", 0)
            start += len(data.get("issues", []))
            if start >= total:
                break
    except Exception as e:
        logger.warning(f"Jira fetch failed: {e}")

    return issues


def format_issues_for_llm(issues: list[dict]) -> str:
    if not issues:
        return "No Jira issues updated in the last 24 hours (or Jira not configured)."
    lines = [
        f"- [{i['jira_key']}] ({i['issue_type']}) {i['summary']} "
        f"| Status: {i['status']} | Assignee: {i.get('assignee','Unassigned')} | Priority: {i.get('priority','N/A')}"
        for i in issues
    ]
    return f"Recent Jira issues ({len(issues)} total):\n" + "\n".join(lines)
```

#### `backend/services/report_service.py`

```python
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from backend.models import Report, Commit, Issue, AgentLog
from backend.database import SessionLocal
from backend.services import github_service, jira_service

logger = logging.getLogger(__name__)


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def run_and_persist() -> int:
    db: Session = SessionLocal()
    report = Report(status="running", run_date=datetime.utcnow())
    db.add(report); db.commit(); db.refresh(report)
    report_id = report.id
    try:
        commits_data = github_service.fetch_recent_commits()
        issues_data  = jira_service.fetch_recent_issues()
        commits_text = github_service.format_commits_for_llm(commits_data)
        issues_text  = jira_service.format_issues_for_llm(issues_data)

        from backend.agents.crew import run_crew
        result = run_crew(commits_text=commits_text, issues_text=issues_text)

        for c in commits_data:
            if not db.query(Commit).filter(Commit.sha == c["sha"]).first():
                db.add(Commit(
                    sha=c["sha"], author=c["author"], message=c["message"],
                    url=c["url"], committed_at=_parse_dt(c.get("committed_at")),
                    report_id=report_id,
                ))
        for i in issues_data:
            db.add(Issue(
                jira_key=i["jira_key"], summary=i["summary"], status=i["status"],
                assignee=i.get("assignee"), priority=i.get("priority"),
                issue_type=i.get("issue_type"),
                updated_at=_parse_dt(i.get("updated_at")),
                report_id=report_id,
            ))
        for role, output in result.get("agent_outputs", {}).items():
            db.add(AgentLog(report_id=report_id, agent_role=role, raw_output=output))

        report.developer_summary = result.get("developer")
        report.qa_summary        = result.get("qa")
        report.pm_summary        = result.get("pm")
        report.combined_output   = result.get("combined")
        report.status            = "completed"
        db.commit()
        logger.info(f"Report {report_id} completed.")
    except Exception as e:
        logger.exception(f"Report {report_id} failed: {e}")
        report.status = "failed"; report.error_message = str(e); db.commit()
    finally:
        db.close()
    return report_id


def run_and_persist_with_id(report_id: int) -> None:
    """Used by the manual /run/now endpoint (report row pre-created)."""
    db: Session = SessionLocal()
    try:
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            return
        commits_data = github_service.fetch_recent_commits()
        issues_data  = jira_service.fetch_recent_issues()
        commits_text = github_service.format_commits_for_llm(commits_data)
        issues_text  = jira_service.format_issues_for_llm(issues_data)

        from backend.agents.crew import run_crew
        result = run_crew(commits_text=commits_text, issues_text=issues_text)

        for c in commits_data:
            if not db.query(Commit).filter(Commit.sha == c["sha"]).first():
                db.add(Commit(
                    sha=c["sha"], author=c["author"], message=c["message"],
                    url=c["url"], committed_at=_parse_dt(c.get("committed_at")),
                    report_id=report_id,
                ))
        for i in issues_data:
            db.add(Issue(
                jira_key=i["jira_key"], summary=i["summary"], status=i["status"],
                assignee=i.get("assignee"), priority=i.get("priority"),
                issue_type=i.get("issue_type"),
                updated_at=_parse_dt(i.get("updated_at")),
                report_id=report_id,
            ))
        for role, output in result.get("agent_outputs", {}).items():
            db.add(AgentLog(report_id=report_id, agent_role=role, raw_output=output))

        report.developer_summary = result.get("developer")
        report.qa_summary        = result.get("qa")
        report.pm_summary        = result.get("pm")
        report.combined_output   = result.get("combined")
        report.run_date          = datetime.utcnow()
        report.status            = "completed"
        db.commit()
    except Exception as e:
        logger.exception(f"Report {report_id} failed: {e}")
        db.query(Report).filter(Report.id == report_id).update(
            {"status": "failed", "error_message": str(e)}
        )
        db.commit()
    finally:
        db.close()


def get_latest_report(db: Session):
    return (
        db.query(Report)
        .filter(Report.status == "completed")
        .order_by(Report.run_date.desc())
        .first()
    )


def list_reports(db: Session, page: int = 1, limit: int = 20):
    offset = (page - 1) * limit
    return (
        db.query(Report)
        .order_by(Report.run_date.desc())
        .offset(offset).limit(limit).all()
    )
```

#### `backend/services/briefing_service.py`

```python
import logging
from datetime import date
from backend.database import SessionLocal
from backend.models_personal import Briefing, PersonalTask, ScheduleEntry

logger = logging.getLogger(__name__)


def run_personal_briefing(briefing_id: int) -> None:
    db = SessionLocal()
    try:
        briefing = db.query(Briefing).filter(Briefing.id == briefing_id).first()
        if not briefing:
            return

        today  = date.today()
        tasks  = db.query(PersonalTask).filter(PersonalTask.status != "done").all()
        sched  = db.query(ScheduleEntry).filter(ScheduleEntry.date == today).all()

        def task_dict(t):
            return {
                "id": t.id, "title": t.title, "priority": t.priority,
                "category": t.category, "status": t.status,
                "due_date": str(t.due_date) if t.due_date else None,
                "estimated_minutes": t.estimated_minutes,
            }

        def entry_dict(e):
            return {
                "id": e.id, "title": e.title, "date": str(e.date),
                "start_time": e.start_time, "end_time": e.end_time,
                "category": e.category,
            }

        from backend.agents.personal_crew import run_personal_crew
        result = run_personal_crew(
            tasks=[task_dict(t) for t in tasks],
            schedule_today=[entry_dict(e) for e in sched],
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
```

### 5.10 Engineering Agents & Crew

#### `backend/agents/developer_agent.py`

```python
from crewai import Agent
from langchain_openai import ChatOpenAI
from backend.tools.github_tool import GitHubCommitsTool
from backend.tools.jira_tool import JiraIssuesTool


def build_developer_agent(commits_text: str = "", issues_text: str = "") -> Agent:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
    return Agent(
        role="Senior Developer",
        goal=(
            "Analyze recent code commits and Jira tasks to produce a clear technical "
            "summary of what changed, why it matters, and what risks or follow-ups exist."
        ),
        backstory=(
            "You are a senior software engineer with deep expertise in code review and "
            "technical communication. You excel at distilling complex commit histories "
            "into actionable summaries for both engineers and non-engineers."
        ),
        tools=[
            GitHubCommitsTool(prefetched_data=commits_text),
            JiraIssuesTool(prefetched_data=issues_text),
        ],
        llm=llm, verbose=True, allow_delegation=False,
    )
```

#### `backend/agents/qa_agent.py`

```python
from crewai import Agent
from langchain_openai import ChatOpenAI
from backend.tools.jira_tool import JiraIssuesTool


def build_qa_agent(issues_text: str = "") -> Agent:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
    return Agent(
        role="QA Engineer",
        goal=(
            "Identify quality risks, open bugs, regressions, and testing gaps "
            "from current Jira issues and recent code changes."
        ),
        backstory=(
            "You are a meticulous QA engineer who has prevented countless production "
            "incidents by spotting patterns in bug reports and commit history."
        ),
        tools=[JiraIssuesTool(prefetched_data=issues_text)],
        llm=llm, verbose=True, allow_delegation=False,
    )
```

#### `backend/agents/pm_agent.py`

```python
from crewai import Agent
from langchain_openai import ChatOpenAI
from backend.tools.jira_tool import JiraIssuesTool


def build_pm_agent(issues_text: str = "") -> Agent:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    return Agent(
        role="Product Manager",
        goal=(
            "Provide a sprint health summary: what's on track, what's blocked, "
            "delivery risk, and recommended focus for the next 24 hours."
        ),
        backstory=(
            "You are an experienced product manager who bridges engineering and business. "
            "You translate technical progress into stakeholder language and keep "
            "delivery commitments front of mind."
        ),
        tools=[JiraIssuesTool(prefetched_data=issues_text)],
        llm=llm, verbose=True, allow_delegation=False,
    )
```

#### `backend/agents/crew.py`

```python
import logging
from crewai import Task, Crew, Process
from backend.agents.developer_agent import build_developer_agent
from backend.agents.qa_agent import build_qa_agent
from backend.agents.pm_agent import build_pm_agent

logger = logging.getLogger(__name__)


def run_crew(commits_text: str = "", issues_text: str = "") -> dict:
    dev_agent = build_developer_agent(commits_text=commits_text, issues_text=issues_text)
    qa_agent  = build_qa_agent(issues_text=issues_text)
    pm_agent  = build_pm_agent(issues_text=issues_text)

    dev_task = Task(
        description=(
            "Use the GitHub Commits Fetcher tool to review recent commits. Produce a "
            "technical summary covering:\n"
            "1. What was built or changed\n"
            "2. Architectural or risky changes to flag\n"
            "3. Dependencies or follow-up tasks needed\n\n"
            f"Raw data:\n{commits_text}"
        ),
        expected_output=(
            "Markdown with sections: ## Changes Overview, ## Risk Flags, ## Follow-ups"
        ),
        agent=dev_agent,
    )

    qa_task = Task(
        description=(
            "Use the Jira Issues Fetcher tool. Produce a QA report covering:\n"
            "1. Open bugs and severity\n"
            "2. Regressions introduced recently\n"
            "3. Testing coverage gaps\n"
            "4. Quality risk score (Low/Medium/High)\n\n"
            f"Raw data:\n{issues_text}"
        ),
        expected_output=(
            "Markdown with sections: ## Open Bugs, ## Regressions, ## Coverage Gaps, ## Quality Risk"
        ),
        agent=qa_agent,
    )

    pm_task = Task(
        description=(
            "Use the Jira Issues Fetcher tool. Produce a PM report covering:\n"
            "1. Sprint velocity and on-track items\n"
            "2. Blockers and at-risk items\n"
            "3. Delivery confidence score (1-10)\n"
            "4. Recommended priority for next 24 hours\n\n"
            f"Raw data:\n{issues_text}"
        ),
        expected_output=(
            "Markdown with sections: ## Sprint Health, ## Blockers, ## Delivery Confidence, ## Next 24h Priority"
        ),
        agent=pm_agent,
    )

    crew = Crew(
        agents=[dev_agent, qa_agent, pm_agent],
        tasks=[dev_task, qa_task, pm_task],
        process=Process.sequential,
        verbose=True,
    )

    crew_output  = crew.kickoff()
    task_outputs = crew_output.tasks_output if hasattr(crew_output, "tasks_output") else []
    dev_out = task_outputs[0].raw if len(task_outputs) > 0 else str(crew_output)
    qa_out  = task_outputs[1].raw if len(task_outputs) > 1 else ""
    pm_out  = task_outputs[2].raw if len(task_outputs) > 2 else ""
    combined = (
        f"# Daily AI Agent Report\n\n"
        f"## Developer Report\n{dev_out}\n\n"
        f"## QA Report\n{qa_out}\n\n"
        f"## PM Report\n{pm_out}"
    )

    return {
        "developer": dev_out, "qa": qa_out, "pm": pm_out,
        "combined": combined,
        "agent_outputs": {"developer": dev_out, "qa": qa_out, "pm": pm_out},
    }
```

### 5.11 Personal Agents & Crew

#### `backend/agents/planner_agent.py`

```python
from crewai import Agent
from langchain_openai import ChatOpenAI


def build_planner_agent(llm=None) -> Agent:
    llm = llm or ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    return Agent(
        role="Personal Productivity Planner",
        goal=(
            "Analyze the user's task list and today's schedule. Produce a clear, "
            "prioritized daily plan: top 3 focus tasks, overdue items, and time estimate."
        ),
        backstory=(
            "World-class productivity coach. Direct, practical, motivating. "
            "Thinks in terms of energy, focus, deadlines, and realistic capacity."
        ),
        llm=llm, verbose=True, allow_delegation=False,
    )
```

#### `backend/agents/scheduler_agent.py`

```python
from crewai import Agent
from langchain_openai import ChatOpenAI


def build_scheduler_agent(llm=None) -> Agent:
    llm = llm or ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
    return Agent(
        role="Schedule Optimizer",
        goal=(
            "Review today's calendar and pending tasks. Identify conflicts, time gaps, "
            "overloaded periods, and recommend specific deep-work time blocks."
        ),
        backstory=(
            "Scheduling expert who understands chronobiology, focus windows, and calendar "
            "hygiene. Gives concrete time-block recommendations, not vague advice."
        ),
        llm=llm, verbose=True, allow_delegation=False,
    )
```

#### `backend/agents/coach_agent.py`

```python
from crewai import Agent
from langchain_openai import ChatOpenAI


def build_coach_agent(llm=None) -> Agent:
    llm = llm or ChatOpenAI(model="gpt-4o-mini", temperature=0.5)
    return Agent(
        role="Personal Growth Coach",
        goal=(
            "Review task patterns, category balance, and completion trends. "
            "Celebrate wins. Give ONE specific, actionable improvement for today."
        ),
        backstory=(
            "Empathetic but honest life coach. Spots patterns others miss. "
            "Celebrates progress and gives exactly one concrete improvement tip."
        ),
        llm=llm, verbose=True, allow_delegation=False,
    )
```

#### `backend/agents/personal_crew.py`

```python
import logging
from datetime import date
from crewai import Task, Crew, Process
from langchain_openai import ChatOpenAI
from backend.agents.planner_agent   import build_planner_agent
from backend.agents.scheduler_agent import build_scheduler_agent
from backend.agents.coach_agent     import build_coach_agent

logger = logging.getLogger(__name__)


def _fmt_tasks(tasks: list[dict]) -> str:
    if not tasks:
        return "No tasks found."
    return "\n".join(
        f"- [{t['priority'].upper()}] [{t['category']}] [{t['status']}] {t['title']}"
        + (f" | Due: {t['due_date']}" if t.get("due_date") else "")
        + (f" | Est: {t['estimated_minutes']}min" if t.get("estimated_minutes") else "")
        for t in tasks
    )


def _fmt_schedule(entries: list[dict]) -> str:
    if not entries:
        return "No schedule entries for today."
    return "\n".join(
        f"- {e['start_time']}–{e['end_time']} | [{e['category']}] {e['title']}"
        for e in sorted(entries, key=lambda x: x["start_time"])
    )


def run_personal_crew(tasks: list[dict], schedule_today: list[dict], today: date) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    planner   = build_planner_agent(llm)
    scheduler = build_scheduler_agent(llm)
    coach     = build_coach_agent(llm)

    tasks_text    = _fmt_tasks(tasks)
    schedule_text = _fmt_schedule(schedule_today)
    today_str     = today.strftime("%A, %B %d %Y")

    planner_task = Task(
        description=(
            f"Today is {today_str}.\n\nTASK LIST:\n{tasks_text}\n\n"
            f"TODAY'S SCHEDULE:\n{schedule_text}\n\n"
            "Produce a prioritized daily plan:\n"
            "1. Top 3 focus tasks (with reasoning)\n"
            "2. Overdue or at-risk items\n"
            "3. Tasks to defer or drop\n"
            "4. Estimated total work hours"
        ),
        expected_output=(
            "Markdown: ## Top 3 Focus Tasks, ## At Risk, ## Defer/Drop, ## Time Estimate"
        ),
        agent=planner,
    )

    scheduler_task = Task(
        description=(
            f"Today is {today_str}.\n\nSCHEDULED EVENTS:\n{schedule_text}\n\n"
            f"PENDING TASKS:\n{tasks_text}\n\n"
            "Optimize the schedule:\n"
            "1. Conflicts or overloaded slots\n"
            "2. Open blocks + suggested tasks\n"
            "3. Specific deep-work window\n"
            "4. Schedule risks"
        ),
        expected_output=(
            "Markdown: ## Conflicts, ## Suggested Time Blocks, ## Deep Work Window, ## Risks"
        ),
        agent=scheduler,
    )

    coach_task = Task(
        description=(
            f"FULL TASK LIST:\n{tasks_text}\n\n"
            "Review patterns:\n"
            "1. Celebrate completed tasks\n"
            "2. Neglected categories\n"
            "3. Recurring blockers\n"
            "4. ONE specific improvement for today"
        ),
        expected_output=(
            "Markdown: ## Wins, ## Neglected Areas, ## Patterns, ## Today's One Improvement"
        ),
        agent=coach,
    )

    crew = Crew(
        agents=[planner, scheduler, coach],
        tasks=[planner_task, scheduler_task, coach_task],
        process=Process.sequential,
        verbose=True,
    )

    crew_output  = crew.kickoff()
    task_outputs = crew_output.tasks_output if hasattr(crew_output, "tasks_output") else []
    plan_out  = task_outputs[0].raw if len(task_outputs) > 0 else str(crew_output)
    sched_out = task_outputs[1].raw if len(task_outputs) > 1 else ""
    coach_out = task_outputs[2].raw if len(task_outputs) > 2 else ""

    combined = (
        f"# Daily Personal Briefing — {today_str}\n\n"
        f"## 📋 Planner\n{plan_out}\n\n"
        f"## 🗓 Schedule\n{sched_out}\n\n"
        f"## 🎯 Coach\n{coach_out}"
    )

    return {
        "planner": plan_out, "scheduler": sched_out,
        "coach": coach_out, "combined": combined,
    }
```

### 5.12 Routers

#### `backend/routers/run.py`

```python
import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Report
from backend.schemas import RunResponse, RunStatusResponse
from backend.services import report_service

router = APIRouter(prefix="/run", tags=["run"])
_active_runs: set[int] = set()


def _run_in_background(report_id: int) -> None:
    try:
        report_service.run_and_persist_with_id(report_id)
    finally:
        _active_runs.discard(report_id)


@router.post("/now", response_model=RunResponse)
def trigger_run(db: Session = Depends(get_db)):
    report = Report(status="running")
    db.add(report); db.commit(); db.refresh(report)
    report_id = report.id
    _active_runs.add(report_id)
    threading.Thread(target=_run_in_background, args=(report_id,), daemon=True).start()
    return RunResponse(
        status="started", report_id=report_id,
        message=f"Poll /api/run/status/{report_id} for progress.",
    )


@router.get("/status/{report_id}", response_model=RunStatusResponse)
def run_status(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return RunStatusResponse(
        report_id=report.id, status=report.status, error_message=report.error_message,
    )
```

#### `backend/routers/tasks.py`

```python
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from backend.database import get_db
from backend.models_personal import PersonalTask

router = APIRouter(prefix="/tasks", tags=["personal-tasks"])


class TaskCreate(BaseModel):
    title:             str
    description:       Optional[str] = None
    priority:          str = "medium"
    category:          str = "personal"
    status:            str = "todo"
    due_date:          Optional[date] = None
    estimated_minutes: Optional[int] = None
    notes:             Optional[str] = None


class TaskUpdate(BaseModel):
    title:             Optional[str] = None
    description:       Optional[str] = None
    priority:          Optional[str] = None
    category:          Optional[str] = None
    status:            Optional[str] = None
    due_date:          Optional[date] = None
    estimated_minutes: Optional[int] = None
    notes:             Optional[str] = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:                int
    title:             str
    description:       Optional[str]
    priority:          str
    category:          str
    status:            str
    due_date:          Optional[date]
    estimated_minutes: Optional[int]
    notes:             Optional[str]
    created_at:        str
    updated_at:        str

    @classmethod
    def from_orm_safe(cls, t: PersonalTask) -> "TaskResponse":
        return cls(
            id=t.id, title=t.title, description=t.description,
            priority=t.priority, category=t.category, status=t.status,
            due_date=t.due_date, estimated_minutes=t.estimated_minutes, notes=t.notes,
            created_at=t.created_at.isoformat(),
            updated_at=t.updated_at.isoformat() if t.updated_at else t.created_at.isoformat(),
        )


@router.get("", response_model=list[TaskResponse])
def list_tasks(
    status: Optional[str] = None, category: Optional[str] = None,
    priority: Optional[str] = None, db: Session = Depends(get_db),
):
    q = db.query(PersonalTask).order_by(
        PersonalTask.due_date.asc().nullslast(), PersonalTask.priority
    )
    if status:   q = q.filter(PersonalTask.status == status)
    if category: q = q.filter(PersonalTask.category == category)
    if priority: q = q.filter(PersonalTask.priority == priority)
    return [TaskResponse.from_orm_safe(t) for t in q.all()]


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    task = PersonalTask(**body.model_dump())
    db.add(task); db.commit(); db.refresh(task)
    return TaskResponse.from_orm_safe(task)


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, body: TaskUpdate, db: Session = Depends(get_db)):
    t = db.query(PersonalTask).filter(PersonalTask.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(t, field, val)
    db.commit(); db.refresh(t)
    return TaskResponse.from_orm_safe(t)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(PersonalTask).filter(PersonalTask.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(t); db.commit()
```

#### `backend/routers/schedule.py`

```python
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
    start_time: str
    end_time:   str
    category:   str = "personal"
    notes:      Optional[str] = None
    recurring:  Optional[str] = None
    task_id:    Optional[int] = None


class EntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int; title: str; date: date
    start_time: str; end_time: str; category: str
    notes: Optional[str]; recurring: Optional[str]; task_id: Optional[int]


@router.get("", response_model=list[EntryResponse])
def list_entries(
    date_from: Optional[date] = None, date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    q = db.query(ScheduleEntry).order_by(ScheduleEntry.date, ScheduleEntry.start_time)
    if date_from: q = q.filter(ScheduleEntry.date >= date_from)
    if date_to:   q = q.filter(ScheduleEntry.date <= date_to)
    return q.all()


@router.post("", response_model=EntryResponse, status_code=201)
def create_entry(body: EntryCreate, db: Session = Depends(get_db)):
    entry = ScheduleEntry(**body.model_dump())
    db.add(entry); db.commit(); db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    e = db.query(ScheduleEntry).filter(ScheduleEntry.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(e); db.commit()
```

#### `backend/routers/briefing.py`

```python
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
    id: int; briefing_date: date; status: str
    planner_output: str | None; scheduler_output: str | None
    coach_output: str | None; combined_output: str | None
    error_message: str | None


@router.get("/latest", response_model=BriefingResponse)
def latest_briefing(db: Session = Depends(get_db)):
    b = db.query(Briefing).filter(Briefing.status == "completed") \
        .order_by(Briefing.briefing_date.desc()).first()
    if not b:
        raise HTTPException(status_code=404, detail="No briefings yet")
    return b


@router.post("/run", status_code=202)
def run_briefing(db: Session = Depends(get_db)):
    b = Briefing(status="running", briefing_date=date.today())
    db.add(b); db.commit(); db.refresh(b)
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
```

---

## 6. Frontend — React / TypeScript / Phaser

### 6.1 `package.json`

```json
{
  "name": "frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.13.6",
    "phaser": "^3.90.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.1",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.0.0",
    "autoprefixer": "^10.4.27",
    "postcss": "^8.5.8",
    "tailwindcss": "^4.2.1",
    "typescript": "~5.9.3",
    "vite": "^8.0.0"
  }
}
```

### 6.2 `vite.config.ts`

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
```

### 6.3 `postcss.config.js`

> **Important:** Tailwind v4 with Vite 8 must use `@tailwindcss/postcss` — **not** `@tailwindcss/vite`.

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

### 6.4 `index.css`

```css
@import "tailwindcss";
```

### 6.5 API Clients

#### `src/api/client.ts`

```ts
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 30000,
})

export interface Commit {
  id: number; sha: string; author: string
  message: string; url: string; committed_at: string | null
}

export interface Issue {
  id: number; jira_key: string; summary: string; status: string
  assignee: string | null; priority: string | null
  issue_type: string | null; updated_at: string | null
}

export interface ReportSummary {
  id: number; run_date: string; status: string; pm_summary: string | null
}

export interface ReportDetail extends ReportSummary {
  developer_summary: string | null; qa_summary: string | null
  combined_output: string | null; error_message: string | null
  created_at: string; commits: Commit[]; issues: Issue[]
}

export interface RunResponse { status: string; report_id: number; message: string }
export interface RunStatus   { report_id: number; status: string; error_message: string | null }

export const fetchLatestReport  = (): Promise<ReportDetail>     => api.get('/reports/latest').then(r => r.data)
export const fetchReports       = (page = 1): Promise<ReportSummary[]> => api.get('/reports', { params: { page, limit: 20 } }).then(r => r.data)
export const fetchReport        = (id: number): Promise<ReportDetail> => api.get(`/reports/${id}`).then(r => r.data)
export const fetchCommits       = (reportId?: number) => api.get<Commit[]>('/commits', { params: { report_id: reportId } }).then(r => r.data)
export const fetchIssues        = (params?: object) => api.get<Issue[]>('/issues', { params }).then(r => r.data)
export const triggerRun         = (): Promise<RunResponse>       => api.post('/run/now').then(r => r.data)
export const fetchRunStatus     = (id: number): Promise<RunStatus> => api.get(`/run/status/${id}`).then(r => r.data)
```

#### `src/api/personalClient.ts`

```ts
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 30000,
})

export type Priority   = 'high' | 'medium' | 'low'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'
export type Category   = 'work' | 'personal' | 'health' | 'learning'

export interface PersonalTask {
  id: number; title: string; description: string | null
  priority: Priority; category: Category; status: TaskStatus
  due_date: string | null; estimated_minutes: number | null
  notes: string | null; created_at: string; updated_at: string
}

export interface TaskCreate {
  title: string; description?: string
  priority?: Priority; category?: Category; status?: TaskStatus
  due_date?: string; estimated_minutes?: number; notes?: string
}

export interface ScheduleEntry {
  id: number; title: string; date: string
  start_time: string; end_time: string; category: string
  notes: string | null; recurring: string | null; task_id: number | null
}

export interface EntryCreate {
  title: string; date: string; start_time: string; end_time: string
  category?: string; notes?: string; recurring?: string; task_id?: number
}

export interface Briefing {
  id: number; briefing_date: string; status: string
  planner_output: string | null; scheduler_output: string | null
  coach_output: string | null; combined_output: string | null
  error_message: string | null
}

// Tasks
export const getTasks    = (params?: Record<string, string>) => api.get<PersonalTask[]>('/tasks', { params }).then(r => r.data)
export const createTask  = (body: TaskCreate) => api.post<PersonalTask>('/tasks', body).then(r => r.data)
export const updateTask  = (id: number, body: Partial<TaskCreate> & { status?: TaskStatus }) => api.patch<PersonalTask>(`/tasks/${id}`, body).then(r => r.data)
export const deleteTask  = (id: number) => api.delete(`/tasks/${id}`)

// Schedule
export const getSchedule  = (params?: { date_from?: string; date_to?: string }) => api.get<ScheduleEntry[]>('/schedule', { params }).then(r => r.data)
export const createEntry  = (body: EntryCreate) => api.post<ScheduleEntry>('/schedule', body).then(r => r.data)
export const deleteEntry  = (id: number) => api.delete(`/schedule/${id}`)

// Briefing
export const getLatestBriefing = () => api.get<Briefing>('/briefing/latest').then(r => r.data)
export const runBriefing       = () => api.post<{ status: string; briefing_id: number }>('/briefing/run').then(r => r.data)
export const getBriefingStatus = (id: number) => api.get<{ briefing_id: number; status: string; error_message: string | null }>(`/briefing/status/${id}`).then(r => r.data)
```

### 6.6 Hooks

#### `src/hooks/usePolling.ts`

```ts
import { useState, useEffect, useCallback } from 'react'

interface PollingState<T> {
  data: T | null; loading: boolean; error: string | null
  lastUpdated: Date | null; refetch: () => void
}

export function usePolling<T>(fetchFn: () => Promise<T>, intervalMs = 30000): PollingState<T> {
  const [data,        setData]        = useState<T | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetch = useCallback(async () => {
    try {
      setData(await fetchFn()); setError(null); setLastUpdated(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, intervalMs)
    return () => clearInterval(id)
  }, [fetch, intervalMs])

  return { data, loading, error, lastUpdated, refetch: fetch }
}
```

#### `src/hooks/useRunStatus.ts`

```ts
import { useState, useEffect, useRef } from 'react'
import { triggerRun, fetchRunStatus } from '../api/client'

type RunState = 'idle' | 'starting' | 'running' | 'completed' | 'failed'

export function useRunStatus(onComplete?: () => void) {
  const [state,    setState]    = useState<RunState>('idle')
  const [reportId, setReportId] = useState<number | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRun = async () => {
    setState('starting'); setError(null)
    try {
      const resp = await triggerRun()
      setReportId(resp.report_id); setState('running')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start run')
      setState('failed')
    }
  }

  useEffect(() => {
    if (state !== 'running' || !reportId) return
    intervalRef.current = setInterval(async () => {
      try {
        const s = await fetchRunStatus(reportId)
        if (s.status === 'completed') { setState('completed'); clearInterval(intervalRef.current!); onComplete?.() }
        else if (s.status === 'failed') { setState('failed'); setError(s.error_message || 'Run failed'); clearInterval(intervalRef.current!) }
      } catch { /* keep polling */ }
    }, 5000)
    return () => clearInterval(intervalRef.current!)
  }, [state, reportId, onComplete])

  return { state, reportId, error, startRun, reset: () => { setState('idle'); setReportId(null); setError(null) } }
}
```

### 6.7 `App.tsx` & Navbar

#### `src/App.tsx`

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Dashboard } from './pages/Dashboard'
import { ReportsHistory } from './pages/ReportsHistory'
import { ReportDetailPage } from './pages/ReportDetailPage'
import { CommitsPage } from './pages/CommitsPage'
import { IssuesPage } from './pages/IssuesPage'
import { OfficePage } from './pages/OfficePage'
import { TasksPage } from './pages/TasksPage'
import { SchedulePage } from './pages/SchedulePage'
import { BriefingPage } from './pages/BriefingPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/office"    element={<OfficePage />} />
            <Route path="/reports"   element={<ReportsHistory />} />
            <Route path="/reports/:id" element={<ReportDetailPage />} />
            <Route path="/commits"   element={<CommitsPage />} />
            <Route path="/issues"    element={<IssuesPage />} />
            <Route path="/tasks"     element={<TasksPage />} />
            <Route path="/schedule"  element={<SchedulePage />} />
            <Route path="/briefing"  element={<BriefingPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
```

#### `src/components/Navbar.tsx`

```tsx
import { Link, useLocation } from 'react-router-dom'

const links = [
  { to: '/',         label: 'Dashboard'   },
  { to: '/briefing', label: '🤖 Briefing' },
  { to: '/tasks',    label: '📝 Tasks'    },
  { to: '/schedule', label: '🗓 Schedule' },
  { to: '/office',   label: '🏢 Office'  },
  { to: '/reports',  label: 'Reports'     },
]

export function Navbar() {
  const { pathname } = useLocation()
  return (
    <nav className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center gap-8">
      <div className="flex items-center gap-2">
        <span className="text-purple-400 text-xl font-bold">⚡</span>
        <span className="text-white font-semibold tracking-tight">AI Agent Office</span>
      </div>
      <div className="flex gap-6 ml-8">
        {links.map(({ to, label }) => (
          <Link key={to} to={to}
            className={`text-sm font-medium transition-colors ${
              pathname === to ? 'text-purple-400' : 'text-slate-400 hover:text-white'
            }`}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

### 6.8 Voice Engine

`src/office/voice.ts` — wraps the browser's Web Speech API. **Zero API cost.**

```ts
/**
 * Voice engine — Web Speech API (SpeechSynthesis).
 * No API key needed; runs entirely in the browser.
 */

export interface VoiceProfile {
  pitch: number   // 0.5 – 2.0
  rate:  number   // 0.5 – 2.0
  lang:  string
  prefer?: string // matched case-insensitive against available voice names
}

const PROFILES: Record<string, VoiceProfile> = {
  narrator: { pitch: 1.05, rate: 0.92, lang: 'en-US', prefer: 'Samantha' },
  dev:      { pitch: 1.1,  rate: 1.05, lang: 'en-US', prefer: 'Alex'     },
  qa:       { pitch: 1.3,  rate: 1.0,  lang: 'en-US', prefer: 'Karen'    },
  pm:       { pitch: 0.95, rate: 0.95, lang: 'en-US', prefer: 'Daniel'   },
}

let _enabled = true
let _voices: SpeechSynthesisVoice[] = []

function _loadVoices() { _voices = window.speechSynthesis.getVoices() }
_loadVoices()
if (typeof window !== 'undefined' && window.speechSynthesis)
  window.speechSynthesis.onvoiceschanged = _loadVoices

function _pickVoice(p: VoiceProfile): SpeechSynthesisVoice | null {
  if (!_voices.length) _loadVoices()
  if (p.prefer) {
    const match = _voices.find(v =>
      v.name.toLowerCase().includes(p.prefer!.toLowerCase()) &&
      v.lang.startsWith(p.lang.split('-')[0])
    )
    if (match) return match
  }
  return _voices.find(v => v.lang.startsWith(p.lang.split('-')[0])) ?? _voices[0] ?? null
}

export function setVoiceEnabled(on: boolean) { _enabled = on; if (!on) window.speechSynthesis.cancel() }
export function isVoiceEnabled() { return _enabled }

export function speak(text: string, agentId: keyof typeof PROFILES = 'narrator'): Promise<void> {
  if (!_enabled || !window.speechSynthesis) return Promise.resolve()
  const clean = text
    .replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '')
    .replace(/[-•]\s/g, '. ').replace(/\n+/g, '. ').replace(/\s{2,}/g, ' ').trim()

  return new Promise(resolve => {
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(clean)
    const profile = PROFILES[agentId] ?? PROFILES.narrator
    const voice = _pickVoice(profile)
    if (voice) utter.voice = voice
    utter.pitch = profile.pitch; utter.rate = profile.rate; utter.lang = profile.lang
    utter.onend = () => resolve(); utter.onerror = () => resolve()
    window.speechSynthesis.speak(utter)
  })
}

export function stopSpeech() { window.speechSynthesis?.cancel() }

// ── Live script from real data ────────────────────────────────────────────────
export interface LiveData {
  tasks: Array<{ title: string; priority: string; status: string; category: string; due_date?: string | null }>
  scheduleToday: Array<{ title: string; start_time: string; end_time: string; category: string }>
}

export function buildLiveScript(data: LiveData) {
  const today = new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
  const { tasks, scheduleToday } = data

  const highTasks  = tasks.filter(t => t.priority === 'high'   && t.status !== 'done')
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const overdue    = tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date())
  const blocked    = tasks.filter(t => t.status === 'blocked')
  const totalActive = tasks.filter(t => t.status !== 'done').length

  // Alex — task summary
  let devText = `Hi, I'm Alex. `
  if (!tasks.length) { devText += `Your task list is empty — a great time to add today's goals!` }
  else {
    devText += `You have ${totalActive} active task${totalActive !== 1 ? 's' : ''}.`
    if (highTasks.length)  devText += ` ${highTasks.length} high-priority: ${highTasks.slice(0,2).map(t=>t.title).join(', ')}.`
    if (inProgress.length) devText += ` In progress: ${inProgress.slice(0,2).map(t=>t.title).join(' and ')}.`
    if (overdue.length)    devText += ` Watch out — ${overdue.length} task${overdue.length>1?'s are':' is'} overdue.`
    if (blocked.length)    devText += ` ${blocked.length} task${blocked.length>1?'s are':' is'} blocked.`
  }

  // Sam — schedule summary
  let qaText = `Hey, I'm Sam. `
  if (!scheduleToday.length) { qaText += `Your calendar is clear — no events today. Block time for focused work.` }
  else {
    const sorted = [...scheduleToday].sort((a,b) => a.start_time.localeCompare(b.start_time))
    qaText += `You have ${scheduleToday.length} event${scheduleToday.length>1?'s':''} today. `
    const first = sorted[0]
    const fmt = (t: string) => { const [h,m] = t.split(':').map(Number); return `${h%12||12}${m?':'+String(m).padStart(2,'0'):''} ${h>=12?'PM':'AM'}` }
    qaText += `Starts with "${first.title}" at ${fmt(first.start_time)}.`
    const meetings = sorted.filter(e => e.category === 'meeting')
    if (meetings.length) qaText += ` You have ${meetings.length} meeting${meetings.length>1?'s':''} — protect buffer time.`
  }

  // Jordan — advice
  let pmText = `And I'm Jordan. `
  if (highTasks.length)   pmText += `Focus on "${highTasks[0].title}" first — highest priority.`
  else if (inProgress.length) pmText += `Keep momentum on "${inProgress[0].title}" — finish before starting new.`
  else pmText += `No critical fires. Use this time for deep work or planning.`
  const healthTasks = tasks.filter(t => t.category === 'health' && t.status !== 'done')
  const workTasks   = tasks.filter(t => t.category === 'work'   && t.status !== 'done')
  if (!healthTasks.length && workTasks.length > 2) pmText += ` No health tasks — don't forget to move your body.`

  const doneTasks = tasks.filter(t => t.status === 'done').length
  let closing = `That's your briefing. `
  if (doneTasks) closing += `You've completed ${doneTasks} task${doneTasks>1?'s':''} — great work! `
  closing += `Head to Briefing for a full AI-written plan. Have a productive day!`

  return [
    { agent: 'narrator' as const, text: `Good ${new Date().getHours()<12?'morning':new Date().getHours()<17?'afternoon':'evening'}! Today is ${today}.` },
    { agent: 'dev'      as const, text: devText  },
    { agent: 'qa'       as const, text: qaText   },
    { agent: 'pm'       as const, text: pmText   },
    { agent: 'narrator' as const, text: closing  },
  ]
}
```

### 6.9 Pages

The full source for each page is extensive; the key patterns used throughout are:

**TasksPage** — filter bar, progress bar, `cleanForm()` to strip empty strings before POST:
```ts
// IMPORTANT: send undefined not "" for optional date/string fields
function cleanForm(form: TaskCreate): TaskCreate {
  return {
    ...form,
    description:       form.description?.trim()       || undefined,
    due_date:          form.due_date?.trim()           || undefined,
    notes:             form.notes?.trim()              || undefined,
    estimated_minutes: form.estimated_minutes          || undefined,
  }
}
```

**SchedulePage** — 7-day calendar grid `07:00–20:00`, each event positioned absolutely by `(timeToMin(start) - 420) / 60 * 52` px from top.

**BriefingPage** — three panels (Planner / Scheduler / Coach) with individual 🔊 Read buttons + Read All. Polls `/api/briefing/status/:id` every 3 s after triggering.

**OfficePage** — hosts a Phaser 3 game (800×520) with `OfficeScene`, voice controls, and a "Run Now" button outside the canvas.

---

## 7. `start.sh` — One-Command Startup

```bash
#!/bin/bash
# AI Agent Office — start backend + frontend

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Starting AI Agent Office"

cd "$ROOT"
if [ ! -d ".venv" ]; then
  echo "Creating Python venv..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r backend/requirements.txt
else
  source .venv/bin/activate
fi

if [ ! -f ".env" ]; then
  echo "No .env found — copying .env.example. Fill in your credentials."
  cp .env.example .env
fi

echo "==> Backend on :8000"
PYTHONPATH="$ROOT" uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

cd "$ROOT/frontend"
if [ ! -d "node_modules" ]; then
  npm install
fi

echo "==> Frontend on :5173"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo "  API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
```

---

## 8. Running the System

### First-time setup

```bash
# 1. Clone / create the project directory
git clone <your-repo> "AI agent Office"
cd "AI agent Office"

# 2. Create your .env
cp .env.example .env
# Fill in OPENAI_API_KEY, GITHUB_TOKEN, GITHUB_REPO

# 3. Run everything
chmod +x start.sh
./start.sh
```

### Frontend only (for UI work)

```bash
cd frontend
npm install
npm run dev
```

### Backend only

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
PYTHONPATH=. uvicorn backend.main:app --reload --port 8000
```

### URLs

| Service   | URL                              |
|-----------|----------------------------------|
| Frontend  | http://localhost:5173            |
| Backend   | http://localhost:8000            |
| Swagger   | http://localhost:8000/docs       |
| Health    | http://localhost:8000/api/health |

---

## 9. API Reference

### Engineering Workflow

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/run/now` | Trigger immediate agent crew run |
| `GET`  | `/api/run/status/{id}` | Poll run status |
| `GET`  | `/api/reports` | List reports (paginated) |
| `GET`  | `/api/reports/latest` | Latest completed report |
| `GET`  | `/api/reports/{id}` | Full report detail |
| `GET`  | `/api/commits` | Recent commits |
| `GET`  | `/api/issues` | Recent Jira issues |

### Personal Productivity

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/api/tasks` | List tasks (filter: status, category, priority) |
| `POST`   | `/api/tasks` | Create task |
| `PATCH`  | `/api/tasks/{id}` | Update task (partial) |
| `DELETE` | `/api/tasks/{id}` | Delete task |
| `GET`    | `/api/schedule` | List schedule entries (date_from, date_to) |
| `POST`   | `/api/schedule` | Create entry |
| `DELETE` | `/api/schedule/{id}` | Delete entry |
| `POST`   | `/api/briefing/run` | Generate personal briefing (async) |
| `GET`    | `/api/briefing/status/{id}` | Poll briefing status |
| `GET`    | `/api/briefing/latest` | Latest completed briefing |

---

## 10. Troubleshooting

### `"Illegal header value b'token '"` — GitHub token error
Your `GITHUB_TOKEN` in `.env` has a leading space. Ensure it is:
```
GITHUB_TOKEN=ghp_yourtoken
```
The service also calls `.strip()` on the token, but whitespace before `=` can still cause issues.

### GitHub returns 404
The repo `owner/repo` doesn't exist or is private with a token lacking `repo` scope. The service returns `[]` gracefully — agents run with no commit data.

### Jira returns nothing
Leave `JIRA_SERVER=https://your-domain.atlassian.net` if you have no Jira. The `_is_configured()` guard detects the placeholder and returns `[]` — agents run with no Jira data.

### Task create fails with 422
The frontend must send `undefined` (not `""`) for optional date fields. Use `cleanForm()` before calling `createTask()`.

### `@tailwindcss/vite` plugin errors with Vite 8
Use `@tailwindcss/postcss` in `postcss.config.js` instead. Do **not** add `@tailwindcss/vite` to `vite.config.ts`.

### `run_and_persist_with_id` not found
Ensure `backend/services/report_service.py` exports this function. The manual trigger router (`routers/run.py`) calls it to avoid creating a duplicate report row.

### Personal models not created
`init_db()` must import `backend.models_personal` **before** calling `Base.metadata.create_all()`. See `database.py` above.

### CrewAI import error — `ChatOpenAI` from wrong module
Use:
```python
from langchain_openai import ChatOpenAI   # ✅ correct
# NOT: from langchain.chat_models import ChatOpenAI  ← deprecated
```

### Voice narration not speaking
- Browser must support `window.speechSynthesis` (Chrome, Edge, Safari — yes; Firefox — partial)
- Voices load asynchronously. The `onvoiceschanged` handler reloads them automatically.
- Make sure "Voice On" is toggled on in the Office page.

---

*Built with FastAPI · CrewAI · LangChain OpenAI · SQLAlchemy · React 19 · Vite 8 · Tailwind v4 · Phaser 3 · Web Speech API*
