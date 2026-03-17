from crewai import Agent
from langchain_openai import ChatOpenAI


def build_scheduler_agent(llm=None) -> Agent:
    llm = llm or ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
    return Agent(
        role="Schedule Optimizer",
        goal=(
            "Review today's calendar entries and pending tasks to identify scheduling "
            "conflicts, time gaps, overloaded periods, and missed opportunities for "
            "deep work. Recommend specific time blocks for unscheduled tasks."
        ),
        backstory=(
            "You are a scheduling expert who understands chronobiology, focus windows, "
            "and calendar hygiene. You know that meetings kill deep work, mornings are "
            "for hard tasks, and buffer time prevents burnout. You give concrete "
            "time-block recommendations, not vague advice."
        ),
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )
