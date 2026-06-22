from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any

class DocumentBase(BaseModel):
    filename: str
    document_type: Optional[str] = "未知"

class DocumentCreate(DocumentBase):
    filepath: str
    file_type: str

class Document(DocumentBase):
    id: int
    filepath: str
    file_type: str
    extracted_data: Optional[str] = None
    summary: Optional[str] = None
    upload_time: datetime
    status: str
    is_archived: bool = False
    link_contract_id: Optional[int] = None
    province: Optional[str] = None
    county: Optional[str] = None
    progress_status: Optional[str] = "等待中"
    source: Optional[str] = "file_archive"




    class Config:
        orm_mode = True
        from_attributes = True

class ExtractedDataUpdate(BaseModel):
    document_type: str
    extracted_data: str # JSON format string
    summary: str
    status: str
