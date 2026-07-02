from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import sessionmaker, DeclarativeBase # Use DeclarativeBase instead of ext.declarative
import datetime

DATABASE_URL = "sqlite:///./security_logs.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Modern 2.0 syntax style for generating the ORM metadata class structure
class Base(DeclarativeBase):
    pass

# Define the structured table architecture for tracking incidents
class IncidentLog(Base):
    __tablename__ = "incident_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    location = Column(String, index=True)
    object_detected = Column(String)
    confidence = Column(Float)

def init_db():
    Base.metadata.create_all(bind=engine)