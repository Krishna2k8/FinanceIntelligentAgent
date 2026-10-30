import os
import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from .models import Statement, Transaction, AuditRequest, ApprovalRequest, AuditSession
from .sample_data import sample_transactions
from .ai_service import extract_statement, choose_next_step
from .tools import detect_stealth_hikes, calculate_annual_leakage, generate_cancellation_script

app = FastAPI(title="Finance Intelligence Agent", version="1.0.0")

origins = [o.strip() for o in os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS: Dict[str, AuditSession] = {}

@app.get("/api/health")
def health_check():
    key = os.getenv("GEMINI_API_KEY", "replace_me")
    configured = bool(key and key != "replace_me")
    return {"status": "ok", "gemini_configured": configured}

@app.get("/api/sample")
def get_sample():
    txs = sample_transactions()
    return {
        "transactions": [t.model_dump(mode="json") for t in txs],
        "currency": "USD",
        "source": "fictional workshop sample"
    }

@app.post("/api/extract")
async def extract_endpoint(
    text: str = Form(None),
    file: UploadFile = File(None)
):
    if not text and not file:
        raise HTTPException(status_code=400, detail="Paste transaction text or choose a file.")
    
    file_bytes = None
    mime_type = file.content_type if file and file.content_type else "application/octet-stream"
    
    if file:
        file_bytes = await file.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="The selected file is empty.")
        if len(file_bytes) > 12 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Please use a file smaller than 12 MB for this classroom demo.")
        
        if file.filename and file.filename.endswith(".csv") or mime_type == "text/csv":
            try:
                decoded = file_bytes.decode("utf-8-sig")
                reader = csv.DictReader(io.StringIO(decoded))
                rows = list(reader)
                if not rows:
                    raise HTTPException(status_code=400, detail="CSV must contain rows.")
                text_payload = "CSV rows (extract/normalize only; do not invent values):\n" + repr(rows)
                statement = extract_statement(text=text_payload)
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded.")
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise e
                raise HTTPException(status_code=400, detail=f"Could not read CSV: {str(e)}")
        else:
            statement = extract_statement(file_bytes=file_bytes, mime_type=mime_type)
    else:
        trimmed_text = text.strip() if text else ""
        if not trimmed_text:
            raise HTTPException(status_code=400, detail="Paste transaction text or choose a file.")
        if len(trimmed_text) > 100000:
            trimmed_text = trimmed_text[:100000]
        statement = extract_statement(text=trimmed_text)

    valid_transactions = []
    validation_errors = []
    for idx, raw_t in enumerate(statement.transactions):
        try:
            validated = Transaction.model_validate(raw_t)
            valid_transactions.append(validated)
        except Exception as err:
            validation_errors.append({"row": idx + 1, "error": str(err)})

    return {
        "transactions": [t.model_dump(mode="json") for t in valid_transactions],
        "notes": statement.notes,
        "validation_errors": validation_errors,
        "count": len(valid_transactions)
    }

@app.post("/api/audits", response_model=AuditSession)
def start_audit(req: AuditRequest):
    if not req.transactions:
        raise HTTPException(status_code=400, detail="Add transactions before starting an audit.")
    
    session_id = str(uuid.uuid4())
    now_str = datetime.now(timezone.utc).strftime("%H:%M")
    
    session = AuditSession(
        session_id=session_id,
        status="analyzing",
        goal=req.goal,
        audit_log=[{
            "time": now_str,
            "type": "started",
            "message": "Audit started.",
            "details": {"transaction_count": len(req.transactions)}
        }]
    )
    SESSIONS[session_id] = session
    
    txs = req.transactions
    findings = []
    tool_results = []
    allowlist = ["detect_stealth_hikes", "calculate_annual_leakage", "generate_cancellation_script", "finish"]
    
    try:
        for _ in range(6):
            session.steps += 1
            decision = choose_next_step(session.goal, findings, tool_results, allowlist)
            
            plan_msg = decision.message or f"Selected {decision.tool_name}."
            session.audit_log.append({
                "time": datetime.now(timezone.utc).strftime("%H:%M"),
                "type": "plan",
                "message": plan_msg,
                "details": {"tool": decision.tool_name, "arguments": decision.arguments}
            })
            
            tool_name = decision.tool_name
            if tool_name == "finish":
                break
            elif tool_name == "detect_stealth_hikes":
                res = detect_stealth_hikes(txs)
                findings = res
                session.findings = res
                tool_results.append({"tool": tool_name, "result": res})
                session.audit_log.append({
                    "time": datetime.now(timezone.utc).strftime("%H:%M"),
                    "type": "tool",
                    "message": "Executed detect_stealth_hikes.",
                    "details": res
                })
            elif tool_name == "calculate_annual_leakage":
                args = decision.arguments
                m_name = args.get("merchant")
                m_amt = args.get("monthly_amount")
                
                matched = None
                for f in findings:
                    if f["merchant"].casefold() == str(m_name).casefold() and abs(f["new_amount"] - float(m_amt)) < 0.001:
                        matched = f
                        break
                if not matched and findings:
                    matched = findings[0]
                
                if matched:
                    res = calculate_annual_leakage(matched["merchant"], matched["new_amount"])
                else:
                    res = {"skipped": "No price hike found."}
                
                tool_results.append({"tool": tool_name, "result": res})
                session.audit_log.append({
                    "time": datetime.now(timezone.utc).strftime("%H:%M"),
                    "type": "tool",
                    "message": "Executed calculate_annual_leakage.",
                    "details": res
                })
            elif tool_name == "generate_cancellation_script":
                args = decision.arguments
                m_name = args.get("merchant")
                matched = None
                for f in findings:
                    if f["merchant"].casefold() == str(m_name).casefold():
                        matched = f
                        break
                if not matched and findings:
                    matched = findings[0]
                
                if matched:
                    res = generate_cancellation_script(matched["merchant"], matched["old_amount"], matched["new_amount"])
                    session.pending_action = {
                        "type": "review_subscription_change",
                        "merchant": matched["merchant"],
                        "old_amount": matched["old_amount"],
                        "new_amount": matched["new_amount"],
                        "change_pct": matched["change_pct"],
                        "date": matched["date"],
                        "annual_cost": round(matched["new_amount"] * 12, 2),
                        "monthly_increase": matched["monthly_increase"],
                        "draft": res["draft"],
                        "sent": False
                    }
                else:
                    res = {"skipped": "No price hike found."}
                
                tool_results.append({"tool": tool_name, "result": res})
                session.audit_log.append({
                    "time": datetime.now(timezone.utc).strftime("%H:%M"),
                    "type": "tool",
                    "message": "Executed generate_cancellation_script.",
                    "details": res
                })
                
                if findings:
                    parts = []
                    for f in findings:
                        parts.append(f"{f['merchant']} increased from ${f['old_amount']:.2f} to ${f['new_amount']:.2f} (+{f['change_pct']:.1f}%). Current annualized cost: ${f['new_amount']*12:.2f}.")
                    session.summary = " ".join(parts)
                else:
                    session.summary = "No subscription price hikes above 10% were found in the provided data."
                
                session.status = "awaiting_approval"
                session.audit_log.append({
                    "time": datetime.now(timezone.utc).strftime("%H:%M"),
                    "type": "approval_required",
                    "message": "Draft ready. Waiting for human approval; nothing has been sent.",
                    "details": {}
                })
                return session
            else:
                raise ValueError("Tool is not allowed")
                
        if findings:
            parts = []
            for f in findings:
                parts.append(f"{f['merchant']} increased from ${f['old_amount']:.2f} to ${f['new_amount']:.2f} (+{f['change_pct']:.1f}%). Current annualized cost: ${f['new_amount']*12:.2f}.")
            session.summary = " ".join(parts)
        else:
            session.summary = "No subscription price hikes above 10% were found in the provided data."
            
        session.status = "done"
        session.audit_log.append({
            "time": datetime.now(timezone.utc).strftime("%H:%M"),
            "type": "completed",
            "message": "Audit completed.",
            "details": {"steps": session.steps}
        })
    except Exception as e:
        session.status = "failed"
        session.summary = f"Audit stopped safely: {str(e)}"
        session.audit_log.append({
            "time": datetime.now(timezone.utc).strftime("%H:%M"),
            "type": "error",
            "message": str(e),
            "details": {}
        })
        
    return session

@app.get("/api/audits/{session_id}", response_model=AuditSession)
def get_audit(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Audit session not found.")
    return SESSIONS[session_id]

@app.post("/api/audits/{session_id}/approval", response_model=AuditSession)
def post_approval(session_id: str, req: ApprovalRequest):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Audit session not found. Start a new audit.")
    session = SESSIONS[session_id]
    if session.status != "awaiting_approval" or not session.pending_action:
        raise HTTPException(status_code=409, detail="This audit has no pending approval.")
    
    now_str = datetime.now(timezone.utc).strftime("%H:%M")
    if req.decision == "approve":
        session.status = "executing"
        session.pending_action["simulated_execution"] = "Approved and recorded locally; no external message was sent."
        session.pending_action["approved"] = True
        session.audit_log.append({
            "time": now_str,
            "type": "approved_simulation",
            "message": f"Approved by user. Reason: {req.reason or 'None'}",
            "details": {"merchant": session.pending_action.get("merchant")}
        })
        session.status = "done"
        session.summary += " Demo action approved and simulated; no message was sent."
    else:
        session.pending_action["approved"] = False
        session.audit_log.append({
            "time": now_str,
            "type": "rejected",
            "message": "Human rejected the proposed action. Nothing was sent.",
            "details": {}
        })
        session.status = "done"
        session.summary += " Proposed action rejected; nothing was sent."
        
    return session
