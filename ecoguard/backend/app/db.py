"""Database setup. SQLite by default so it runs anywhere with zero setup;
set DATABASE_URL to a PostgreSQL / TimescaleDB URL for a real deployment
(e.g. postgresql+psycopg://user:pass@host/ecoguard). The models below are
plain SQLAlchemy, so they work on both."""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./ecoguard.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass
