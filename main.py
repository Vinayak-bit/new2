import hashlib
import os
import httpx
from pathlib import Path
from datetime import date, timedelta
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import engine, SessionLocal
from classifier import classify_expense, warm_up
import uvicorn


# ── Auto-migrate ───────────────────────────────────────────────────────────────
def run_migrations():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "users" not in tables or "expenses" not in tables:
        models.Base.metadata.create_all(bind=engine)
        return
    cols = [c["name"] for c in inspector.get_columns("expenses")]
    if "user_id" not in cols:
        print("⚠️  Adding missing user_id column to expenses table.")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE expenses ADD COLUMN user_id INTEGER"))
            conn.commit()
    for table in ("budgets", "monthly_income", "streaks", "achievements"):
        if table not in tables:
            models.Base.metadata.create_all(bind=engine)
    if "budgets" in tables:
        bcols = [c["name"] for c in inspector.get_columns("budgets")]
        if "allocated" not in bcols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE budgets ADD COLUMN allocated FLOAT"))
                conn.commit()

run_migrations()
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Vault — Expense Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

warm_up()

# ── Groq config ────────────────────────────────────────────────────────────────
GROQ_API_KEY  = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL    = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

DIST_DIR = Path("dist")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()


def build_expense_context(user_name: str, expenses: list) -> str:
    if not expenses:
        return "The user has no recorded expenses yet."
    total = sum(e.amount for e in expenses)
    by_category: dict[str, float] = {}
    by_month:    dict[str, float] = {}
    for e in expenses:
        by_category[e.category] = by_category.get(e.category, 0) + e.amount
        month = e.date[:7]
        by_month[month] = by_month.get(month, 0) + e.amount
    recent = sorted(expenses, key=lambda x: x.date, reverse=True)[:15]
    cat_lines   = "\n".join(
        f"  {cat}: ₹{amt:,.2f}  ({amt / total * 100:.1f}%)"
        for cat, amt in sorted(by_category.items(), key=lambda x: -x[1])
    )
    month_lines = "\n".join(
        f"  {m}: ₹{a:,.2f}"
        for m, a in sorted(by_month.items(), reverse=True)[:6]
    )
    recent_lines = "\n".join(
        f"  [{e.date}] {e.description} — ₹{e.amount:,.2f} ({e.category})"
        for e in recent
    )
    return (
        f"USER: {user_name}\n"
        f"TOTAL SPENT (all time): ₹{total:,.2f}\n"
        f"TOTAL TRANSACTIONS: {len(expenses)}\n\n"
        f"SPENDING BY CATEGORY:\n{cat_lines}\n\n"
        f"MONTHLY TOTALS (recent 6 months):\n{month_lines}\n\n"
        f"MOST RECENT 15 TRANSACTIONS:\n{recent_lines}"
    )


# ── Mount React static assets ─────────────────────────────────────────────────
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")


# ── Auth ───────────────────────────────────────────────────────────────────────
@app.post("/auth/register", response_model=schemas.AuthResponse)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user = models.User(
        name=payload.name.strip(),
        email=email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=schemas.AuthResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user  = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="No account found with that email")
    if user.hashed_password != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    return user


# ── Auto-classify ──────────────────────────────────────────────────────────────
@app.post("/classify", response_model=schemas.ClassifyResponse)
def classify(payload: schemas.ClassifyRequest):
    return classify_expense(payload.description)


# ── Expenses ───────────────────────────────────────────────────────────────────
@app.get("/expenses", response_model=List[schemas.ExpenseOut])
def get_expenses(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Expense).filter(models.Expense.user_id == user_id).all()


@app.get("/expenses/summary")
def get_summary(user_id: int, db: Session = Depends(get_db)):
    exps    = db.query(models.Expense).filter(models.Expense.user_id == user_id).all()
    summary = {}
    for e in exps:
        summary[e.category] = summary.get(e.category, 0) + e.amount
    return summary


@app.post("/expenses", response_model=schemas.ExpenseOut)
def create_expense(expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    if not db.query(models.User).filter(models.User.id == expense.user_id).first():
        raise HTTPException(status_code=404, detail="User not found — please log out and log in again")
    db_expense = models.Expense(**expense.model_dump())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
    return {"deleted": expense_id}


# ── Budgets ────────────────────────────────────────────────────────────────────
@app.get("/budgets", response_model=List[schemas.BudgetOut])
def get_budgets(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Budget).filter(models.Budget.user_id == user_id).all()


@app.post("/budgets", response_model=schemas.BudgetOut)
def upsert_budget(payload: schemas.BudgetUpsert, db: Session = Depends(get_db)):
    allocated = payload.allocated if payload.allocated is not None else payload.monthly_limit
    existing = db.query(models.Budget).filter(
        models.Budget.user_id == payload.user_id,
        models.Budget.category == payload.category
    ).first()
    if existing:
        existing.monthly_limit = payload.monthly_limit
        existing.allocated     = allocated
        db.commit()
        db.refresh(existing)
        return existing
    budget = models.Budget(
        user_id=payload.user_id,
        category=payload.category,
        monthly_limit=payload.monthly_limit,
        allocated=allocated,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@app.delete("/budgets/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.query(models.Budget).filter(models.Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
    return {"deleted": budget_id}


# ── ZBB: Income ────────────────────────────────────────────────────────────────
@app.get("/income")
def get_income(user_id: int, month: str, db: Session = Depends(get_db)):
    return db.query(models.MonthlyIncome).filter(
        models.MonthlyIncome.user_id == user_id,
        models.MonthlyIncome.month == month,
    ).all()


@app.post("/income", response_model=schemas.IncomeOut)
def set_income(payload: schemas.IncomeCreate, db: Session = Depends(get_db)):
    source = payload.source or "Salary"
    existing = db.query(models.MonthlyIncome).filter(
        models.MonthlyIncome.user_id == payload.user_id,
        models.MonthlyIncome.month == payload.month,
        models.MonthlyIncome.source == source,
    ).first()
    if existing:
        existing.amount = payload.amount
        db.commit()
        db.refresh(existing)
        return existing
    income = models.MonthlyIncome(
        user_id=payload.user_id,
        month=payload.month,
        amount=payload.amount,
        source=source,
    )
    db.add(income)
    db.commit()
    db.refresh(income)
    return income


# ── ZBB: Overview ──────────────────────────────────────────────────────────────
@app.get("/zbb/overview", response_model=schemas.ZBBOverview)
def zbb_overview(user_id: int, month: str, db: Session = Depends(get_db)):
    incomes = db.query(models.MonthlyIncome).filter(
        models.MonthlyIncome.user_id == user_id,
        models.MonthlyIncome.month == month,
    ).all()
    total_income = sum(i.amount for i in incomes)

    budgets = db.query(models.Budget).filter(models.Budget.user_id == user_id).all()
    expenses = db.query(models.Expense).filter(
        models.Expense.user_id == user_id,
        models.Expense.date.like(f"{month}%"),
    ).all()

    by_cat: dict[str, float] = {}
    for e in expenses:
        by_cat[e.category] = by_cat.get(e.category, 0) + e.amount

    envelopes = []
    total_allocated = 0.0
    total_spent = 0.0
    for b in budgets:
        alloc = b.allocated if b.allocated is not None else b.monthly_limit
        spent = by_cat.get(b.category, 0.0)
        remaining = alloc - spent
        pct = (spent / alloc * 100) if alloc else 0.0
        total_allocated += alloc
        total_spent += spent
        envelopes.append(schemas.EnvelopeStatus(
            category=b.category, monthly_limit=b.monthly_limit,
            allocated=alloc, spent=spent, remaining=remaining, pct_used=pct,
        ))

    return schemas.ZBBOverview(
        month=month, total_income=total_income,
        total_allocated=total_allocated, total_spent=total_spent,
        unallocated=total_income - total_allocated, envelopes=envelopes,
    )


# ── ZBB: Transfer ──────────────────────────────────────────────────────────────
@app.post("/zbb/transfer")
def transfer_envelope(payload: schemas.EnvelopeTransfer, db: Session = Depends(get_db)):
    src = db.query(models.Budget).filter(
        models.Budget.user_id == payload.user_id,
        models.Budget.category == payload.from_category,
    ).first()
    dst = db.query(models.Budget).filter(
        models.Budget.user_id == payload.user_id,
        models.Budget.category == payload.to_category,
    ).first()
    if not src or not dst:
        raise HTTPException(status_code=404, detail="Budget envelope not found")
    src_alloc = src.allocated if src.allocated is not None else src.monthly_limit
    if payload.amount > src_alloc:
        raise HTTPException(status_code=400, detail="Insufficient funds in source envelope")
    src.allocated = src_alloc - payload.amount
    dst.allocated = (dst.allocated if dst.allocated is not None else dst.monthly_limit) + payload.amount
    db.commit()
    return {"transferred": payload.amount, "from": payload.from_category, "to": payload.to_category}


# ── Gamification ──────────────────────────────────────────────────────────────
BADGE_DEFINITIONS = [
    ("streak_any_3",  "3-Day Streak",    "🔥", lambda s, cat, spent, budgets: s >= 3),
    ("streak_any_7",  "Week Warrior",    "⚡", lambda s, cat, spent, budgets: s >= 7),
    ("streak_any_14", "Fortnight Hero",  "💎", lambda s, cat, spent, budgets: s >= 14),
    ("streak_any_30", "Monthly Master",  "👑", lambda s, cat, spent, budgets: s >= 30),
    ("under_50pct",   "Half Budget",     "🎯", lambda s, cat, spent, budgets: budgets.get(cat, 0) > 0 and spent <= budgets.get(cat, 0) * 0.5),
    ("zero_food",     "Home Chef",       "🍳", lambda s, cat, spent, budgets: cat == "food" and spent == 0),
    ("zero_entertain","Entertainment Free","📵",lambda s, cat, spent, budgets: cat == "entertainment" and spent == 0),
]


def _get_current_month_spent(user_id: int, db) -> dict[str, float]:
    today = date.today()
    month = today.strftime("%Y-%m")
    exps = db.query(models.Expense).filter(
        models.Expense.user_id == user_id,
        models.Expense.date.like(f"{month}%"),
    ).all()
    result: dict[str, float] = {}
    for e in exps:
        result[e.category] = result.get(e.category, 0) + e.amount
    return result


@app.post("/gamification/check", response_model=schemas.GamificationUpdate)
def check_gamification(user_id: int, db: Session = Depends(get_db)):
    today = date.today()
    yesterday = (today - timedelta(days=1)).isoformat()
    today_str = today.isoformat()

    budgets = db.query(models.Budget).filter(models.Budget.user_id == user_id).all()
    budgets_by_cat = {b.category: b.monthly_limit for b in budgets}

    y_expenses = (
        db.query(models.Expense)
        .filter(models.Expense.user_id == user_id, models.Expense.date == yesterday)
        .all()
    )
    y_spent: dict[str, float] = {}
    for e in y_expenses:
        y_spent[e.category] = y_spent.get(e.category, 0) + e.amount

    mtd_spent = _get_current_month_spent(user_id, db)

    updated_streaks:  list[models.Streak] = []
    new_achievements: list[models.Achievement] = []
    broken_streaks:   list[str] = []

    for budget in budgets:
        cat   = budget.category
        limit = budget.monthly_limit
        import calendar
        days_in_month = calendar.monthrange(today.year, today.month)[1]
        daily_limit   = limit / days_in_month

        streak = (
            db.query(models.Streak)
            .filter(models.Streak.user_id == user_id, models.Streak.category == cat)
            .first()
        )
        if not streak:
            streak = models.Streak(user_id=user_id, category=cat, current_streak=0, best_streak=0, last_checked=None)
            db.add(streak)
            db.flush()

        if streak.last_checked == today_str:
            continue

        spent_yesterday = y_spent.get(cat, 0.0)
        if spent_yesterday <= daily_limit:
            streak.current_streak += 1
            if streak.current_streak > streak.best_streak:
                streak.best_streak = streak.current_streak
            updated_streaks.append(streak)
        else:
            if streak.current_streak > 0:
                broken_streaks.append(cat)
            streak.current_streak = 0

        streak.last_checked = today_str

        already_earned = {
            a.badge_key
            for a in db.query(models.Achievement)
            .filter(
                models.Achievement.user_id == user_id,
                models.Achievement.earned_at.like(f"{today.strftime('%Y-%m')}%"),
            ).all()
        }
        for badge_key, badge_name, badge_icon, condition in BADGE_DEFINITIONS:
            if badge_key in already_earned:
                continue
            if condition(streak.current_streak, cat, mtd_spent.get(cat, 0), budgets_by_cat):
                ach = models.Achievement(
                    user_id=user_id, badge_key=badge_key,
                    badge_name=badge_name, badge_icon=badge_icon, earned_at=today_str,
                )
                db.add(ach)
                new_achievements.append(ach)

    db.commit()
    for s in updated_streaks: db.refresh(s)
    for a in new_achievements: db.refresh(a)

    return schemas.GamificationUpdate(
        updated_streaks=[schemas.StreakOut(id=s.id, user_id=s.user_id, category=s.category, current_streak=s.current_streak, best_streak=s.best_streak, last_checked=s.last_checked) for s in updated_streaks],
        new_achievements=[schemas.AchievementOut(id=a.id, user_id=a.user_id, badge_key=a.badge_key, badge_name=a.badge_name, badge_icon=a.badge_icon, earned_at=a.earned_at) for a in new_achievements],
        broken_streaks=broken_streaks,
    )


@app.get("/gamification/streaks", response_model=List[schemas.StreakOut])
def get_streaks(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Streak).filter(models.Streak.user_id == user_id).all()


@app.get("/gamification/achievements", response_model=List[schemas.AchievementOut])
def get_achievements(user_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Achievement)
        .filter(models.Achievement.user_id == user_id)
        .order_by(models.Achievement.earned_at.desc())
        .all()
    )


# ── AI Chat ───────────────────────────────────────────────────────────────────
@app.post("/chat", response_model=schemas.ChatResponse)
async def chat_with_advisor(payload: schemas.ChatRequest, db: Session = Depends(get_db)):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not set. Add it as an environment variable.")
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    expenses = db.query(models.Expense).filter(models.Expense.user_id == payload.user_id).all()
    budgets  = db.query(models.Budget).filter(models.Budget.user_id == payload.user_id).all()
    expense_context = build_expense_context(user.name, expenses)

    budget_context = ""
    if budgets:
        import datetime as _dt
        by_cat = {}
        for e in expenses:
            month = e.date[:7]
            if month == _dt.date.today().strftime('%Y-%m'):
                by_cat[e.category] = by_cat.get(e.category, 0) + e.amount
        lines = []
        for b in budgets:
            alloc = b.allocated if b.allocated is not None else b.monthly_limit
            spent = by_cat.get(b.category, 0)
            pct   = (spent / alloc * 100) if alloc else 0
            lines.append(f"  {b.category}: envelope ₹{alloc:,.0f} (limit ₹{b.monthly_limit:,.0f}), spent ₹{spent:,.0f} ({pct:.0f}%)")
        budget_context = "\nMONTHLY ZBB ENVELOPES (current month):\n" + "\n".join(lines)

    system_prompt = f"""You are Aria, a warm and insightful personal finance advisor embedded inside the Vault expense tracking app.

CURRENT FINANCIAL DATA:
{expense_context}{budget_context}

GUIDELINES:
- Give ultra-concise, direct, and precise answers by default (1-3 sentences).
- ONLY provide longer, detailed responses (up to 3 paragraphs) if the user asks a complex, open-ended question or explicitly requests a deep dive or analysis.
- Be conversational, supportive, and encouraging — never judgmental.
- Reference specific numbers, categories, and dates from their data.
- Flag micro-patterns: subscription traps, frequent small recurring purchases, lifestyle inflation spikes.
- If the user has budgets set, reference how they're tracking vs those budgets.
- Use ₹ symbol for Indian Rupees."""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in payload.history[-10:]:
        messages.append({"role": msg.role if msg.role != "model" else "assistant", "content": msg.content})
    messages.append({"role": "user", "content": payload.message})

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            GROQ_CHAT_URL,
            json={"model": GROQ_MODEL, "messages": messages, "temperature": 0.7, "max_tokens": 1024},
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Groq error: {resp.text[:300]}")

    return {"reply": resp.json()["choices"][0]["message"]["content"]}


# ── Serve React SPA (catch-all — must be last) ────────────────────────────────
@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    """Serve the React app for all non-API routes."""
    index = DIST_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return {"message": "React build not found. Run: cd vault-frontend && npm install && npm run build"}


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)