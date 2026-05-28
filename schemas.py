from pydantic import BaseModel
from typing import List, Optional


# ── Auth ──────────────────────────────────────────────
class UserCreate(BaseModel):
    name:     str
    email:    str
    password: str

class LoginRequest(BaseModel):
    email:    str
    password: str

class AuthResponse(BaseModel):
    id:    int
    name:  str
    email: str

    class Config:
        from_attributes = True


# ── Expenses ──────────────────────────────────────────
class ExpenseCreate(BaseModel):
    description: str
    amount:      float
    category:    str
    date:        str
    user_id:     int

class ExpenseOut(BaseModel):
    id:          int
    description: str
    amount:      float
    category:    str
    date:        str
    user_id:     int

    class Config:
        from_attributes = True


# ── Budgets (ZBB-extended) ────────────────────────────
class BudgetUpsert(BaseModel):
    user_id:       int
    category:      str
    monthly_limit: float
    allocated:     Optional[float] = None   # defaults to monthly_limit if omitted

class BudgetOut(BaseModel):
    id:            int
    user_id:       int
    category:      str
    monthly_limit: float
    allocated:     Optional[float] = None

    class Config:
        from_attributes = True


# ── ZBB: Monthly Income ───────────────────────────────
class IncomeCreate(BaseModel):
    user_id: int
    month:   str          # "YYYY-MM"
    amount:  float
    source:  Optional[str] = "Salary"

class IncomeOut(BaseModel):
    id:      int
    user_id: int
    month:   str
    amount:  float
    source:  Optional[str]

    class Config:
        from_attributes = True


# ── ZBB: Envelope Transfer ────────────────────────────
class EnvelopeTransfer(BaseModel):
    user_id:       int
    from_category: str
    to_category:   str
    amount:        float


# ── ZBB: Overview ─────────────────────────────────────
class EnvelopeStatus(BaseModel):
    category:      str
    monthly_limit: float
    allocated:     float
    spent:         float
    remaining:     float
    pct_used:      float

class ZBBOverview(BaseModel):
    month:           str
    total_income:    float
    total_allocated: float
    total_spent:     float
    unallocated:     float
    envelopes:       List[EnvelopeStatus]


# ── Gamification: Streaks ─────────────────────────────
class StreakOut(BaseModel):
    id:             int
    user_id:        int
    category:       str
    current_streak: int
    best_streak:    int
    last_checked:   Optional[str]

    class Config:
        from_attributes = True


# ── Gamification: Achievements ────────────────────────
class AchievementOut(BaseModel):
    id:         int
    user_id:    int
    badge_key:  str
    badge_name: str
    badge_icon: Optional[str]
    earned_at:  str

    class Config:
        from_attributes = True


# ── Gamification: Check response ─────────────────────
class GamificationUpdate(BaseModel):
    """Returned after POST /gamification/check — tells the frontend what to celebrate."""
    updated_streaks:     List[StreakOut]
    new_achievements:    List[AchievementOut]
    broken_streaks:      List[str]   # category names whose streaks reset to 0


# ── AI Auto-Classify ─────────────────────────────────
class ClassifyRequest(BaseModel):
    description: str

class ClassifyResponse(BaseModel):
    category:   str
    confidence: float


# ── AI Chat ───────────────────────────────────────────
class ChatMessage(BaseModel):
    role:    str   # "user" or "model"
    content: str

class ChatRequest(BaseModel):
    user_id: int
    message: str
    history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    reply: str