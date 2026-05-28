from sqlalchemy import Column, Integer, String, Float, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    name             = Column(String, nullable=False)
    email            = Column(String, unique=True, nullable=False, index=True)
    hashed_password  = Column(String, nullable=False)


class Expense(Base):
    __tablename__ = "expenses"

    id          = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=False)
    amount      = Column(Float,  nullable=False)
    category    = Column(String, nullable=False)
    date        = Column(String, nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)


class Budget(Base):
    """
    One row per user+category.
    Now also carries 'allocated' for ZBB envelope tracking.
    'monthly_limit' = the hard cap the user originally set;
    'allocated'     = the envelope balance after any mid-month transfers.
    Both default to the same value at creation time.
    """
    __tablename__ = "budgets"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    category      = Column(String,  nullable=False)
    monthly_limit = Column(Float,   nullable=False)
    allocated     = Column(Float,   nullable=True)   # ZBB: current envelope balance

    __table_args__ = (
        UniqueConstraint("user_id", "category", name="uq_user_category"),
    )


class MonthlyIncome(Base):
    """
    ZBB: the user declares their total take-home income for a given month
    before distributing it across envelopes.
    month format: "YYYY-MM"
    """
    __tablename__ = "monthly_income"

    id      = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    month   = Column(String,  nullable=False)          # e.g. "2026-05"
    amount  = Column(Float,   nullable=False)
    source  = Column(String,  nullable=True)           # e.g. "Salary", "Freelance"

    __table_args__ = (
        UniqueConstraint("user_id", "month", "source", name="uq_user_month_source"),
    )


class Streak(Base):
    """
    Tracks per-user per-category budget streaks.
    Incremented each day the user stays under budget for that category.
    'best' stores the all-time best run.
    """
    __tablename__ = "streaks"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    category        = Column(String,  nullable=False)
    current_streak  = Column(Integer, default=0)
    best_streak     = Column(Integer, default=0)
    last_checked    = Column(String,  nullable=True)   # "YYYY-MM-DD"

    __table_args__ = (
        UniqueConstraint("user_id", "category", name="uq_streak_user_category"),
    )


class Achievement(Base):
    """
    Badges earned by the user. One row per award event so the same
    badge can be earned again (e.g. a monthly milestone).
    """
    __tablename__ = "achievements"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    badge_key  = Column(String,  nullable=False)   # machine key, e.g. "streak_food_7"
    badge_name = Column(String,  nullable=False)   # display name
    badge_icon = Column(String,  nullable=True)    # emoji
    earned_at  = Column(String,  nullable=False)   # ISO date string