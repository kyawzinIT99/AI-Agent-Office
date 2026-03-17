from crewai import Agent
from langchain_openai import ChatOpenAI
from backend.tools.jira_tool import JiraIssuesTool


def build_qa_agent(issues_text: str = "") -> Agent:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)

    return Agent(
        role="QA Engineer",
        goal=(
            "Identify quality risks, open bugs, regressions, and testing gaps "
            "from the current Jira issues and recent code changes. Produce a "
            "concise quality posture report."
        ),
        backstory=(
            "You are a meticulous QA engineer who has prevented countless production "
            "incidents by spotting patterns in bug reports and commit history. "
            "You think in terms of risk: what's most likely to break, and what's "
            "the impact if it does."
        ),
        tools=[
            JiraIssuesTool(prefetched_data=issues_text),
        ],
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )
