from crewai import Agent
from langchain_openai import ChatOpenAI


def build_coach_agent(llm=None) -> Agent:
    llm = llm or ChatOpenAI(model="gpt-4o-mini", temperature=0.5)
    return Agent(
        role="Personal Growth Coach",
        goal=(
            "Review overall task completion, patterns in blocked/overdue items, and "
            "category balance (work/health/learning/personal). Celebrate wins, identify "
            "recurring obstacles, and give one actionable improvement suggestion."
        ),
        backstory=(
            "You are an empathetic but honest life coach. You notice patterns others "
            "miss — like always blocking health tasks, or over-committing on Mondays. "
            "You celebrate progress genuinely and give exactly one concrete, specific "
            "improvement tip — never a generic list of tips."
        ),
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )
