from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, Boolean as SQLBoolean
from datetime import datetime
from .database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    filepath = Column(String)
    file_type = Column(String) # e.g., image/jpeg, application/pdf
    document_type = Column(String, index=True) # e.g., 发票, 合同, 收发货单, 未知
    extracted_data = Column(Text) # JSON string of extracted info
    summary = Column(Text)
    upload_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending") # pending, processed, failed
    is_archived = Column(SQLBoolean, default=False)
    link_contract_id = Column(Integer, nullable=True)
    province = Column(String, nullable=True)
    county = Column(String, nullable=True)
    progress_status = Column(String, default="等待中")
    source = Column(String, default="file_archive")



