import logging
from datetime import datetime
from sqlalchemy.orm import Session
from backend.models import Report, Commit, Issue, AgentLog
from backend.database import SessionLocal
from backend.services import github_service, jira_service

logger = logging.getLogger(__name__)


def _parse_committed_at(dt_str: str | None) -> datetime | None:
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except Exception:
        return None


def run_and_persist() -> int:
    """Run the full agent crew and persist results. Returns report_id."""
    db: Session = SessionLocal()

    # Create report row immediately so frontend can poll
    report = Report(status="running", run_date=datetime.utcnow())
    db.add(report)
    db.commit()
    db.refresh(report)
    report_id = report.id

    try:
        # Fetch raw data
        logger.info("Fetching GitHub commits...")
        commits_data = github_service.fetch_recent_commits()

        logger.info("Fetching Jira issues...")
        issues_data = jira_service.fetch_recent_issues()

        commits_text = github_service.format_commits_for_llm(commits_data)
        issues_text = jira_service.format_issues_for_llm(issues_data)

        # Run CrewAI (imported here to avoid circular imports)
        from backend.agents.crew import run_crew
        logger.info("Running agent crew...")
        result = run_crew(commits_text=commits_text, issues_text=issues_text)

        # Persist commits
        for c in commits_data:
            existing = db.query(Commit).filter(Commit.sha == c["sha"]).first()
            if not existing:
                commit = Commit(
                    sha=c["sha"],
                    author=c["author"],
                    message=c["message"],
                    url=c["url"],
                    committed_at=_parse_committed_at(c.get("committed_at")),
                    report_id=report_id,
                )
                db.add(commit)

        # Persist issues
        for i in issues_data:
            issue = Issue(
                jira_key=i["jira_key"],
                summary=i["summary"],
                status=i["status"],
                assignee=i.get("assignee"),
                priority=i.get("priority"),
                issue_type=i.get("issue_type"),
                updated_at=_parse_committed_at(i.get("updated_at")),
                report_id=report_id,
            )
            db.add(issue)

        # Persist agent logs
        for role, output in result.get("agent_outputs", {}).items():
            log = AgentLog(
                report_id=report_id,
                agent_role=role,
                raw_output=output,
            )
            db.add(log)

        # Update report with summaries
        report.developer_summary = result.get("developer")
        report.qa_summary = result.get("qa")
        report.pm_summary = result.get("pm")
        report.combined_output = result.get("combined")
        report.status = "completed"
        db.commit()
        logger.info(f"Report {report_id} completed successfully.")

    except Exception as e:
        logger.exception(f"Report {report_id} failed: {e}")
        report.status = "failed"
        report.error_message = str(e)
        db.commit()

    finally:
        db.close()

    return report_id


def run_and_persist_with_id(report_id: int) -> None:
    """Run crew for a pre-created report row (used by the manual trigger endpoint)."""
    db: Session = SessionLocal()
    try:
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            return

        commits_data = github_service.fetch_recent_commits()
        issues_data = jira_service.fetch_recent_issues()
        commits_text = github_service.format_commits_for_llm(commits_data)
        issues_text = jira_service.format_issues_for_llm(issues_data)

        from backend.agents.crew import run_crew
        result = run_crew(commits_text=commits_text, issues_text=issues_text)

        for c in commits_data:
            existing = db.query(Commit).filter(Commit.sha == c["sha"]).first()
            if not existing:
                db.add(Commit(
                    sha=c["sha"], author=c["author"], message=c["message"],
                    url=c["url"], committed_at=_parse_committed_at(c.get("committed_at")),
                    report_id=report_id,
                ))

        for i in issues_data:
            db.add(Issue(
                jira_key=i["jira_key"], summary=i["summary"], status=i["status"],
                assignee=i.get("assignee"), priority=i.get("priority"),
                issue_type=i.get("issue_type"),
                updated_at=_parse_committed_at(i.get("updated_at")),
                report_id=report_id,
            ))

        for role, output in result.get("agent_outputs", {}).items():
            db.add(AgentLog(report_id=report_id, agent_role=role, raw_output=output))

        report.developer_summary = result.get("developer")
        report.qa_summary = result.get("qa")
        report.pm_summary = result.get("pm")
        report.combined_output = result.get("combined")
        report.run_date = datetime.utcnow()
        report.status = "completed"
        db.commit()

    except Exception as e:
        logger.exception(f"Report {report_id} failed: {e}")
        db.query(Report).filter(Report.id == report_id).update(
            {"status": "failed", "error_message": str(e)}
        )
        db.commit()
    finally:
        db.close()


def get_report(db: Session, report_id: int) -> Report | None:
    return db.query(Report).filter(Report.id == report_id).first()


def get_latest_report(db: Session) -> Report | None:
    return (
        db.query(Report)
        .filter(Report.status == "completed")
        .order_by(Report.run_date.desc())
        .first()
    )


def list_reports(db: Session, page: int = 1, limit: int = 20) -> list[Report]:
    offset = (page - 1) * limit
    return (
        db.query(Report)
        .order_by(Report.run_date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
