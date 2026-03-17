from crewai import Agent
from langchain_openai import ChatOpenAI
from backend.tools.jira_tool import JiraIssuesTool


def build_pm_agent(issues_text: str = "") -> Agent:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

    return Agent(
        role="Product Manager",
        goal=(
            "Provide a sprint health summary: what's on track, what's blocked, "
            "delivery risk assessment, and a recommended focus for the next 24 hours."
        ),
        backstory=(
            "You are an experienced product manager who bridges engineering and "
            "business. You translate technical progress into stakeholder-friendly "
            "language, highlight blockers before they become crises, and always "
            "keep delivery commitments front of mind."
        ),
        tools=[
            JiraIssuesTool(prefetched_data=issues_text),
        ],
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )
