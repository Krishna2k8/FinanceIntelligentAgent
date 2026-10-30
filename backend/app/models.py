from datetime import date
from typing import Literal, Optional, Dict, Any, List
from pydantic import BaseModel, Field

Category = Literal[
    "Dining",
    "Fuel",
    "Shopping",
    "Subscriptions",
    "Food delivery",
    "Income",
    "Bills",
    "Other",
]

class Transaction(BaseModel):
    merchant: str = Field(..., min_length=1, max_length=120)
    date: Optional[date] = None
    category: Category = "Other"
    amount: float
    raw_line: Optional[str] = None

class Statement(BaseModel):
    transactions: List[Transaction] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)

class AuditRequest(BaseModel):
    transactions: List[Transaction]
    goal: str = "Audit my transactions for subscription traps and silent price hikes."

class ApprovalRequest(BaseModel):
    decision: Literal["approve", "reject"]
    reason: Optional[str] = None

class AgentDecision(BaseModel):
    tool_name: Literal[
        "detect_stealth_hikes",
        "calculate_annual_leakage",
        "generate_cancellation_script",
        "finish"
    ]
    arguments: Dict[str, Any] = Field(default_factory=dict)
    message: str = ""

class AuditSession(BaseModel):
    session_id: str
    status: Literal["analyzing", "awaiting_approval", "executing", "done", "failed"] = "analyzing"
    goal: str
    findings: List[Dict[str, Any]] = Field(default_factory=list)
    pending_action: Optional[Dict[str, Any]] = None
    audit_log: List[Dict[str, Any]] = Field(default_factory=list)
    summary: str = ""
    steps: int = 0
