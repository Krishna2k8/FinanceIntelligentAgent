# Finance Intelligence Agent (Finwise)

> A minimal, classroom-friendly full-stack web application (React + Vite frontend, Python FastAPI backend) demonstrating grounded GenAI extraction and a bounded ReAct-style AI agent audit loop on personal finance data.

## 1. Project Overview

**Finwise** demonstrates two key AI patterns safely and transparently:

1. **Layer 1 — GenAI extraction:** Pasted text or uploaded files (receipts/statements in PNG, JPG, PDF, CSV, TXT format up to 12 MB) are parsed and normalised into structured JSON via Google Gemini, validated with Pydantic, and displayed on a finance dashboard.
2. **Layer 2 — AI agent audit:** A bounded, ReAct-style agent loop (max 6 steps) chooses from an allowlist of deterministic Python tools to detect silent subscription price hikes, calculate annualised costs, and draft cancellation/dispute messages. All actions are held behind a human-approval gate and recorded in a visible audit trace.

> **Note:** This is an educational demo, not financial advice. It uses fictional sample data, keeps state in memory, and never sends emails, contacts merchants or banks, or moves money. Approval is simulated locally.

---

## 2. Project Structure

```
finance-intelligence-agent/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── ai_service.py     # AI boundary (Gemini extraction & LLM planner stub)
│   │   ├── main.py           # FastAPI routes, agent loop, in-memory sessions
│   │   ├── models.py         # Pydantic v2 schemas
│   │   ├── sample_data.py    # Fictional starter transactions
│   │   └── tools.py          # Deterministic finance tools
│   ├── tests/
│   │   └── test_tools.py     # Pytest test suite
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React single-page application dashboard
│   │   ├── main.jsx          # React entry point
│   │   └── styles.css        # Polished custom styling
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── README.md
└── .gitignore
```

---

## 3. Prerequisites

- **Python 3.11+** (3.12 recommended)
- **Node.js 20+** and `npm`

---

## 4. Environment Setup & Configuration

1. Clone or extract the project repository.
2. Navigate to the backend folder and copy the environment template:
   ```bash
   cd backend
   cp .env.example .env
   ```
3. Open `backend/.env` and configure your settings:
   - `GEMINI_API_KEY`: Leave as `replace_me` to run in **demo mode** (fully offline with sample data and deterministic fallback planner), or insert your Google Gemini API key.
   - `GEMINI_MODEL`: Defaults to `gemini-2.5-flash`.
   - `FRONTEND_ORIGIN`: Defaults to `http://localhost:5173`.

---

## 5. Running the Application Locally

### Backend Server (FastAPI)
Open a terminal, navigate to `backend/`, create a virtual environment, install dependencies, and start Uvicorn:
```bash
cd backend
python -m venv .venv

# Activate virtual environment:
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- Interactive API docs are available at [http://localhost:8000/docs](http://localhost:8000/docs).
- Run unit tests using pytest: `pytest`

### Frontend Server (React + Vite)
Open a **new** terminal window, navigate to `frontend/`, install packages, and start Vite:
```bash
cd frontend
npm install
npm run dev
```
- Open your browser and navigate to [http://localhost:5173](http://localhost:5173).

---

## 6. Recommended 6-Step Demo Flow

1. **Load Dashboard:** Visit `http://localhost:5173`. The 14 fictional sample transactions load automatically, displaying 4 metric cards, spending activity charts, category breakdowns, and the transactions table.
2. **Inspect AI Status:** Check the top-right status pill. It will display **"Demo mode available"** (if no key is provided) or **"Gemini connected"** (if a valid API key is set).
3. **Run Agent Audit:** Scroll to the autonomous agent section and click **"Run agent audit"**.
4. **Inspect Trace & Findings:** Watch the agent trace timeline execute step-by-step (`detect_stealth_hikes` → `calculate_annual_leakage` → `generate_cancellation_script`). View the detected StreamBox Premium price hike card (+30%, $37.69 → $49.00).
5. **Human Approval Gate:** Review the generated cancellation/dispute draft showing the annual cost ($588.00). Notice the **"NOT SENT"** badge. Click **"Approve simulation"** (or **Reject**).
6. **Verify Simulation:** Confirm the state updates to decision recorded and check the audit log. Note that no external emails or network requests were made.

---

## 7. API Endpoints Table

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Backend status + `gemini_configured` flag |
| `GET` | `/api/sample` | Fictional starter transactions (14 records) |
| `POST` | `/api/extract` | Multipart `text` and/or `file` → validated transactions |
| `POST` | `/api/audits` | Start a bounded audit from typed transactions |
| `GET` | `/api/audits/{session_id}` | Read audit state and trace |
| `POST` | `/api/audits/{session_id}/approval` | Body `{"decision": "approve"}` or `{"decision": "reject"}` |

---

## 8. Troubleshooting & Known Limitations

- **Frontend cannot connect / CORS error:** Ensure the backend is running on port 8000 and `FRONTEND_ORIGIN` matches your frontend URL. If running on a different port, set `VITE_API_URL=http://localhost:8000` in a frontend `.env` file.
- **Gemini not configured:** If `GEMINI_API_KEY` is missing or `replace_me`, extraction requests return `503`, but the dashboard, sample data, and offline agent planner continue to work seamlessly in demo mode.
- **Port in use:** If port 8000 or 5173 is occupied, run Uvicorn on another port (e.g., `--port 8001`) and update `VITE_API_URL` accordingly.