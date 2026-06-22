import os
import json

CONFIG_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "config.json"))

DEFAULT_DOC_TYPES = ["合同", "发票", "收发货单", "回款凭证", "其他"]
DEFAULT_CONTRACT_TYPES = ["合同", "销售合同"]

def get_config():
    default_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "archive"))
    default_invoice_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "archive_invoices"))
    config = {
        "archive_dir": default_dir,
        "invoice_archive_dir": default_invoice_dir,
        "document_types": DEFAULT_DOC_TYPES,
        "contract_types": DEFAULT_CONTRACT_TYPES
    }
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                user_config = json.load(f)
                config.update(user_config)
        except Exception as e:
            print("Failed to read config, using defaults:", e)
            
    # Write back if file doesn't exist or keys are missing
    need_write = False
    if not os.path.exists(CONFIG_FILE):
        need_write = True
    else:
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                disk_config = json.load(f)
                if "document_types" not in disk_config or "contract_types" not in disk_config or "invoice_archive_dir" not in disk_config:
                    need_write = True
        except:
            need_write = True

    if need_write:
        try:
            os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=4)
        except Exception as e:
            print("Failed to save config defaults:", e)
            
    return config

def update_config(config_data):
    config = get_config()
    config.update(config_data)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=4)
    # Ensure the new archive directory exists
    if "archive_dir" in config:
        os.makedirs(config["archive_dir"], exist_ok=True)
    if "invoice_archive_dir" in config:
        os.makedirs(config["invoice_archive_dir"], exist_ok=True)
    return config
