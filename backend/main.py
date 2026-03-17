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
    # Startup
    init_db()
    logger.info("Database tables ensured.")
    start_scheduler()
    yield
    # Shutdown
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
