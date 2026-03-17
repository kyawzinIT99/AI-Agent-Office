from crewai import Agent
from langchain_openai import ChatOpenAI
from backend.tools.github_tool import GitHubCommitsTool
from backend.tools.jira_tool import JiraIssuesTool


def build_developer_agent(commits_text: str = "", issues_text: str = "") -> Agent:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)

    return Agent(
        role="Senior Developer",
        goal=(
            "Analyze recent code commits and related Jira tasks to produce a "
            "clear technical summary of what changed, why it matters, and what "
            "risks or follow-ups exist."
        ),
        backstory=(
            "You are a senior software engineer with deep expertise in code review "
            "and technical communication. You excel at distilling complex commit "
            "histories into actionable summaries that both engineers and non-engineers "
            "can understand."
        ),
        tools=[
            GitHubCommitsTool(prefetched_data=commits_text),
            JiraIssuesTool(prefetched_data=issues_text),
        ],
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )
