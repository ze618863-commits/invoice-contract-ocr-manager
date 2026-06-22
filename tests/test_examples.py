import json
from pathlib import Path


def test_sample_ocr_output_is_valid_json():
    sample_path = Path("examples/sample-ocr-output.json")

    payload = json.loads(sample_path.read_text(encoding="utf-8"))
    fields = payload["fields"]

    assert payload["document_type"] == "invoice"
    assert fields["vendor_name"] == "Example Vendor LLC"
    assert fields["invoice_number"] == "INV-2026-0001"
    assert fields["currency"] == "USD"
    assert isinstance(payload["line_items"], list)
    assert payload["line_items"]


def test_sample_documents_do_not_contain_common_private_placeholders():
    sample_docs = Path("examples/sample-documents.md").read_text(encoding="utf-8").lower()

    private_markers = [
        "taxpayer identification number",
        "social security",
        "bank account",
        "real customer",
        "real vendor",
    ]

    for marker in private_markers:
        assert marker not in sample_docs
