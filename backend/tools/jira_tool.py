from crewai.tools import BaseTool
from pydantic import Field
from backend.services.jira_service import fetch_recent_issues, format_issues_for_llm


class JiraIssuesTool(BaseTool):
    name: str = "Jira Issues Fetcher"
    description: str = (
        "Fetches recent Jira issues from the configured project that were "
        "updated in the last 24 hours. Returns a formatted list of issues "
        "with their key, type, status, assignee, and priority. Use this to "
        "understand the current sprint state, bugs, and task progress."
    )
    prefetched_data: str = Field(default="", exclude=True)

    def _run(self, query: str = "") -> str:
        if self.prefetched_data:
            return self.prefetched_data
        issues = fetch_recent_issues()
        return format_issues_for_llm(issues)
