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


def _auth() -> HTTPBasicAuth:
    return HTTPBasicAuth(settings.jira_email, settings.jira_api_token)


def _headers() -> dict:
    return {"Accept": "application/json", "Content-Type": "application/json"}


def fetch_recent_issues(since_hours: int = 24) -> list[dict[str, Any]]:
    if not _is_configured():
        logger.warning("Jira not configured (placeholder domain) — skipping issue fetch.")
        return []

    since = datetime.now(timezone.utc) - timedelta(hours=since_hours)
    since_str = since.strftime("%Y-%m-%d")
    jql = (
        f'project = "{settings.jira_project_key}" '
        f'AND updated >= "{since_str}" '
        f'ORDER BY updated DESC'
    )

    url = f"{settings.jira_server}/rest/api/3/search"
    params: dict = {
        "jql": jql,
        "maxResults": 100,
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
                fields = issue.get("fields", {})
                assignee = fields.get("assignee") or {}
                issues.append({
                    "jira_key": issue["key"],
                    "summary": fields.get("summary", ""),
                    "status": (fields.get("status") or {}).get("name", "Unknown"),
                    "assignee": assignee.get("displayName"),
                    "priority": (fields.get("priority") or {}).get("name"),
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
    lines = []
    for i in issues:
        assignee = i.get("assignee") or "Unassigned"
        lines.append(
            f"- [{i['jira_key']}] ({i['issue_type']}) {i['summary']} "
            f"| Status: {i['status']} | Assignee: {assignee} | Priority: {i.get('priority', 'N/A')}"
        )
    return f"Recent Jira issues ({len(issues)} total):\n" + "\n".join(lines)
