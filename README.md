# Invoice Contract OCR Manager

Invoice Contract OCR Manager is a local-first document processing application for importing invoices, contracts, receipts, delivery notes, and related business documents. It provides OCR extraction, document classification, structured archiving, duplicate detection, and ledger export workflows through a FastAPI backend and a React/Vite frontend.

The project is designed for teams that need an offline-friendly workflow for scanning, reviewing, correcting, and archiving business documents without sending files to a hosted SaaS product.

## Features

- Upload PDF and image documents for OCR processing.
- Classify documents such as contracts, invoices, delivery notes, payment receipts, and other files.
- Extract structured fields from OCR text for review and correction.
- Archive documents into organized folders.
- Maintain a local SQLite index of processed documents.
- Export and update Excel ledgers with `openpyxl`.
- Run locally as a desktop-style application through the provided Python launcher.

## Tech stack

- Backend: FastAPI, SQLAlchemy, SQLite, Pydantic
- OCR and document parsing: RapidOCR, PyMuPDF, Pillow
- Excel handling: openpyxl
- Frontend: React, Vite, Axios, lucide-react

## Repository layout

```text
backend/              FastAPI application, database models, OCR and archive logic
frontend/             React/Vite user interface
run_desktop.py        Local launcher that starts the backend and opens the app
setup_portable_python.ps1
                      Optional helper for preparing a portable Python runtime
config.example.json   Example local configuration
```

Local runtime folders such as `archive/`, `archive_invoices/`, `uploads/`, `scratch/`, database files, virtual environments, and build outputs are intentionally excluded from the repository.

## Getting started

### Prerequisites

- Python 3.10 or later
- Node.js 20 or later
- npm

### Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
cd ..
python run_desktop.py
```

The launcher starts the FastAPI backend on a local port and opens the frontend in your browser.

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

For production builds:

```bash
cd frontend
npm run build
```

## Configuration

The application creates `config.json` automatically when needed. You can also copy the example file:

```bash
copy config.example.json config.json
```

Do not commit `config.json`, local archives, uploaded documents, SQLite databases, or generated ledgers. These files may contain private business data.

## Privacy and data handling

This project is intended to run locally. Documents, OCR text, local databases, and Excel ledgers can contain confidential business information. Before publishing forks, issues, screenshots, or test fixtures, remove company names, invoice numbers, tax identifiers, addresses, signatures, and payment information.

## Open-source status

This repository is prepared for open-source release with an MIT license. The current codebase is local-first and does not require hosted infrastructure. Contributions that improve OCR accuracy, i18n, test coverage, packaging, and security hardening are welcome.

## Roadmap

- Add a formal test suite outside the local `scratch/` folder.
- Add sample redacted fixtures.
- Add English-first UI text and optional localization.
- Add CI for backend linting and frontend builds.
- Improve typed API schemas and database migrations.
- Package the desktop launcher for easier installation.

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.
