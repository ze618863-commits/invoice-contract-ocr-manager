from datetime import datetime

from backend.schemas import Document, DocumentCreate, ExtractedDataUpdate


def test_document_create_requires_path_and_file_type():
    document = DocumentCreate(
        filename="sample-invoice.pdf",
        filepath="uploads/sample-invoice.pdf",
        file_type="application/pdf",
    )

    assert document.filename == "sample-invoice.pdf"
    assert document.filepath == "uploads/sample-invoice.pdf"
    assert document.file_type == "application/pdf"
    assert document.document_type == "未知"


def test_document_schema_defaults():
    document = Document(
        id=1,
        filename="sample-contract.pdf",
        filepath="uploads/sample-contract.pdf",
        file_type="application/pdf",
        upload_time=datetime(2026, 1, 1, 12, 0, 0),
        status="processed",
    )

    assert document.is_archived is False
    assert document.progress_status == "等待中"
    assert document.source == "file_archive"
    assert document.link_contract_id is None


def test_extracted_data_update_payload():
    payload = ExtractedDataUpdate(
        document_type="invoice",
        extracted_data='{"invoice_number": "INV-2026-0001"}',
        summary="Sample invoice from Example Vendor LLC.",
        status="reviewed",
    )

    assert payload.document_type == "invoice"
    assert "INV-2026-0001" in payload.extracted_data
    assert payload.status == "reviewed"
