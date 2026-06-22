import json

from backend import config_service


def test_get_config_creates_default_config_file(tmp_path, monkeypatch):
    config_path = tmp_path / "config.json"
    monkeypatch.setattr(config_service, "CONFIG_FILE", str(config_path))

    config = config_service.get_config()

    assert config_path.exists()
    assert "archive_dir" in config
    assert "invoice_archive_dir" in config
    assert config["document_types"] == ["合同", "发票", "收发货单", "回款凭证", "其他"]

    saved_config = json.loads(config_path.read_text(encoding="utf-8"))
    assert saved_config["document_types"] == config["document_types"]
    assert saved_config["contract_types"] == ["合同", "销售合同"]


def test_get_config_merges_user_values(tmp_path, monkeypatch):
    config_path = tmp_path / "config.json"
    config_path.write_text(
        json.dumps(
            {
                "archive_dir": str(tmp_path / "custom-archive"),
                "document_types": ["invoice", "contract"],
                "contract_types": ["contract"],
                "invoice_archive_dir": str(tmp_path / "custom-invoices"),
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(config_service, "CONFIG_FILE", str(config_path))

    config = config_service.get_config()

    assert config["archive_dir"].endswith("custom-archive")
    assert config["invoice_archive_dir"].endswith("custom-invoices")
    assert config["document_types"] == ["invoice", "contract"]


def test_update_config_persists_values_and_creates_directories(tmp_path, monkeypatch):
    config_path = tmp_path / "config.json"
    archive_dir = tmp_path / "archive"
    invoice_archive_dir = tmp_path / "invoices"
    monkeypatch.setattr(config_service, "CONFIG_FILE", str(config_path))

    config = config_service.update_config(
        {
            "archive_dir": str(archive_dir),
            "invoice_archive_dir": str(invoice_archive_dir),
            "document_types": ["invoice", "contract", "other"],
        }
    )

    assert config["document_types"] == ["invoice", "contract", "other"]
    assert archive_dir.exists()
    assert invoice_archive_dir.exists()

    saved_config = json.loads(config_path.read_text(encoding="utf-8"))
    assert saved_config["archive_dir"] == str(archive_dir)
