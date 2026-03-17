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
