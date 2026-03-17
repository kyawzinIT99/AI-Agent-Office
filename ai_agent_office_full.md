# AI Agent Office System (Full Build)

## Overview
This system simulates an AI-powered engineering team where agents:
- Pull updates from GitHub & Jira
- Run automated scrum meetings
- Generate daily reports
- Display results in a dashboard UI

---

## Features
- Multi-agent workflow (Developer, QA, PM)
- GitHub API integration
- Jira API integration
- SQLite database storage
- Web dashboard (React)
- Optional 2D office simulation UI

---

## Tech Stack
- Python (CrewAI, LangChain)
- Node.js (React frontend)
- SQLite (local database)
- APIs (GitHub, Jira)

---

## Installation

### 1. Clone Project
```bash
git clone https://github.com/your-repo/ai-agent-office.git
cd ai-agent-office
```

### 2. Install Backend
```bash
pip install crewai langchain openai sqlite3 requests
```

### 3. Install Frontend
```bash
cd frontend
npm install
```

---

## Environment Variables

Create `.env` file:

```
OPENAI_API_KEY=your_key
GITHUB_TOKEN=your_token
JIRA_API_TOKEN=your_token
JIRA_EMAIL=your_email
JIRA_DOMAIN=your_domain.atlassian.net
```

---

## Backend Example (main.py)

```python
from crewai import Agent, Task, Crew
from langchain.chat_models import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")

dev = Agent(role="Developer", goal="Summarize GitHub commits", llm=llm)
qa = Agent(role="QA", goal="Identify bugs", llm=llm)
pm = Agent(role="PM", goal="Generate report", llm=llm)

task1 = Task(description="Get GitHub updates", agent=dev)
task2 = Task(description="Analyze QA issues", agent=qa)
task3 = Task(description="Create final report", agent=pm)

crew = Crew(agents=[dev, qa, pm], tasks=[task1, task2, task3])

print(crew.run())
```

---

## GitHub Integration

```python
import requests

def get_commits():
    url = "https://api.github.com/repos/owner/repo/commits"
    headers = {"Authorization": "token YOUR_TOKEN"}
    return requests.get(url, headers=headers).json()
```

---

## Jira Integration

```python
from requests.auth import HTTPBasicAuth

def get_jira_tasks():
    url = "https://your-domain.atlassian.net/rest/api/3/search"
    auth = HTTPBasicAuth("email", "api_token")
    return requests.get(url, auth=auth).json()
```

---

## SQLite Storage

```python
import sqlite3

conn = sqlite3.connect("data.db")
c = conn.cursor()

c.execute("CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY, content TEXT)")
conn.commit()
```

---

## Frontend (React)

```bash
npx create-react-app dashboard
cd dashboard
npm start
```

Display reports via API.

---

## Optional Office UI

Use:
- Phaser.js (2D office simulation)
- Three.js (3D office)

---

## Run System

```bash
python main.py
npm start
```

---

## Deployment
- Backend: Render / Railway
- Frontend: Vercel / Netlify

---

## Future Improvements
- Real-time Slack integration
- Voice stand-up meetings
- Autonomous task execution

---

## Done
You now have a full AI Agent Office system.
