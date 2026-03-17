import logging
from crewai import Task, Crew, Process
from backend.agents.developer_agent import build_developer_agent
from backend.agents.qa_agent import build_qa_agent
from backend.agents.pm_agent import build_pm_agent

logger = logging.getLogger(__name__)


def run_crew(commits_text: str = "", issues_text: str = "") -> dict:
    """
    Assemble and run the full agent crew.
    Returns a dict with keys: developer, qa, pm, combined, agent_outputs.
    """
    dev_agent = build_developer_agent(commits_text=commits_text, issues_text=issues_text)
    qa_agent = build_qa_agent(issues_text=issues_text)
    pm_agent = build_pm_agent(issues_text=issues_text)

    dev_task = Task(
        description=(
            "Use the GitHub Commits Fetcher tool to get recent commits. "
            "Then produce a technical summary covering:\n"
            "1. What was built or changed (bullet points per commit area)\n"
            "2. Any architectural or risky changes to flag\n"
            "3. Dependencies or follow-up tasks needed\n\n"
            f"Raw data for context:\n{commits_text}"
        ),
        expected_output=(
            "A markdown-formatted technical summary with sections: "
            "## Changes Overview, ## Risk Flags, ## Follow-ups"
        ),
        agent=dev_agent,
    )

    qa_task = Task(
        description=(
            "Use the Jira Issues Fetcher tool to get current issues. "
            "Focus on bugs, test failures, and quality risks. Produce a report covering:\n"
            "1. Open bugs and their severity\n"
            "2. Any regressions introduced recently\n"
            "3. Testing coverage gaps based on recent changes\n"
            "4. Quality risk score (Low/Medium/High) with justification\n\n"
            f"Raw data for context:\n{issues_text}"
        ),
        expected_output=(
            "A markdown-formatted QA report with sections: "
            "## Open Bugs, ## Regressions, ## Coverage Gaps, ## Quality Risk"
        ),
        agent=qa_agent,
    )

    pm_task = Task(
        description=(
            "Use the Jira Issues Fetcher tool to review the sprint. "
            "Produce a stakeholder-ready sprint health summary covering:\n"
            "1. Sprint velocity and on-track items\n"
            "2. Blockers and at-risk items\n"
            "3. Delivery confidence score (1-10) with reasoning\n"
            "4. Recommended priority for next 24 hours\n\n"
            f"Raw data for context:\n{issues_text}"
        ),
        expected_output=(
            "A markdown-formatted PM report with sections: "
            "## Sprint Health, ## Blockers, ## Delivery Confidence, ## Next 24h Priority"
        ),
        agent=pm_agent,
    )

    crew = Crew(
        agents=[dev_agent, qa_agent, pm_agent],
        tasks=[dev_task, qa_task, pm_task],
        process=Process.sequential,
        verbose=True,
    )

    crew_output = crew.kickoff()

    # Extract per-agent outputs
    task_outputs = crew_output.tasks_output if hasattr(crew_output, "tasks_output") else []
    dev_out = task_outputs[0].raw if len(task_outputs) > 0 else str(crew_output)
    qa_out = task_outputs[1].raw if len(task_outputs) > 1 else ""
    pm_out = task_outputs[2].raw if len(task_outputs) > 2 else ""

    combined = f"# Daily AI Agent Report\n\n## Developer Report\n{dev_out}\n\n## QA Report\n{qa_out}\n\n## PM Report\n{pm_out}"

    return {
        "developer": dev_out,
        "qa": qa_out,
        "pm": pm_out,
        "combined": combined,
        "agent_outputs": {
            "developer": dev_out,
            "qa": qa_out,
            "pm": pm_out,
        },
    }
