import logging
from datetime import date
from crewai import Task, Crew, Process
from langchain_openai import ChatOpenAI
from backend.agents.planner_agent   import build_planner_agent
from backend.agents.scheduler_agent import build_scheduler_agent
from backend.agents.coach_agent     import build_coach_agent

logger = logging.getLogger(__name__)


def _fmt_tasks(tasks: list[dict]) -> str:
    if not tasks:
        return "No tasks found."
    lines = []
    for t in tasks:
        due = f" | Due: {t['due_date']}" if t.get("due_date") else ""
        est = f" | Est: {t['estimated_minutes']}min" if t.get("estimated_minutes") else ""
        lines.append(
            f"- [{t['priority'].upper()}] [{t['category']}] [{t['status']}] {t['title']}{due}{est}"
        )
    return "\n".join(lines)


def _fmt_schedule(entries: list[dict]) -> str:
    if not entries:
        return "No schedule entries for today."
    lines = []
    for e in sorted(entries, key=lambda x: x["start_time"]):
        lines.append(f"- {e['start_time']}–{e['end_time']} | [{e['category']}] {e['title']}")
    return "\n".join(lines)


def run_personal_crew(
    tasks: list[dict],
    schedule_today: list[dict],
    today: date,
) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    planner   = build_planner_agent(llm)
    scheduler = build_scheduler_agent(llm)
    coach     = build_coach_agent(llm)

    tasks_text    = _fmt_tasks(tasks)
    schedule_text = _fmt_schedule(schedule_today)
    today_str     = today.strftime("%A, %B %d %Y")

    planner_task = Task(
        description=(
            f"Today is {today_str}.\n\n"
            f"TASK LIST:\n{tasks_text}\n\n"
            f"TODAY'S SCHEDULE:\n{schedule_text}\n\n"
            "Produce a prioritized daily plan:\n"
            "1. Top 3 focus tasks for today (with reasoning)\n"
            "2. Overdue or at-risk items that need attention\n"
            "3. Tasks to defer or drop\n"
            "4. Estimated total work hours required"
        ),
        expected_output=(
            "Markdown with sections: ## Top 3 Focus Tasks, ## At Risk, "
            "## Defer/Drop, ## Time Estimate"
        ),
        agent=planner,
    )

    scheduler_task = Task(
        description=(
            f"Today is {today_str}.\n\n"
            f"SCHEDULED EVENTS:\n{schedule_text}\n\n"
            f"PENDING TASKS:\n{tasks_text}\n\n"
            "Optimize the schedule:\n"
            "1. Identify conflicts or overloaded time slots\n"
            "2. Find open time blocks and suggest tasks to fill them\n"
            "3. Recommend a specific time for deep work\n"
            "4. Flag any schedule risks"
        ),
        expected_output=(
            "Markdown with sections: ## Conflicts, ## Suggested Time Blocks, "
            "## Deep Work Window, ## Risks"
        ),
        agent=scheduler,
    )

    coach_task = Task(
        description=(
            f"FULL TASK LIST (all statuses):\n{tasks_text}\n\n"
            "Review patterns and progress:\n"
            "1. What has the user completed recently? Celebrate it.\n"
            "2. What categories are being neglected?\n"
            "3. Are there recurring blockers or procrastination patterns?\n"
            "4. Give ONE specific, actionable improvement for today."
        ),
        expected_output=(
            "Markdown with sections: ## Wins, ## Neglected Areas, "
            "## Patterns, ## Today's One Improvement"
        ),
        agent=coach,
    )

    crew = Crew(
        agents=[planner, scheduler, coach],
        tasks=[planner_task, scheduler_task, coach_task],
        process=Process.sequential,
        verbose=True,
    )

    crew_output = crew.kickoff()
    task_outputs = crew_output.tasks_output if hasattr(crew_output, "tasks_output") else []
    plan_out  = task_outputs[0].raw if len(task_outputs) > 0 else str(crew_output)
    sched_out = task_outputs[1].raw if len(task_outputs) > 1 else ""
    coach_out = task_outputs[2].raw if len(task_outputs) > 2 else ""

    combined = (
        f"# Daily Personal Briefing — {today_str}\n\n"
        f"## 📋 Planner\n{plan_out}\n\n"
        f"## 🗓 Schedule\n{sched_out}\n\n"
        f"## 🎯 Coach\n{coach_out}"
    )

    return {
        "planner":   plan_out,
        "scheduler": sched_out,
        "coach":     coach_out,
        "combined":  combined,
    }
