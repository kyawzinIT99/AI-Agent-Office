from crewai.tools import BaseTool
from pydantic import Field
from backend.services.github_service import fetch_recent_commits, format_commits_for_llm


class GitHubCommitsTool(BaseTool):
    name: str = "GitHub Commits Fetcher"
    description: str = (
        "Fetches recent Git commits from the configured GitHub repository "
        "for the last 24 hours. Returns a formatted summary of all commits "
        "including author, SHA, and message. Use this to understand what code "
        "changes have been made recently."
    )
    # Pre-fetched data injected at runtime to avoid redundant API calls
    prefetched_data: str = Field(default="", exclude=True)

    def _run(self, query: str = "") -> str:
        if self.prefetched_data:
            return self.prefetched_data
        commits = fetch_recent_commits()
        return format_commits_for_llm(commits)
