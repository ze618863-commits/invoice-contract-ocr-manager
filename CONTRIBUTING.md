# Contributing

Thank you for considering a contribution to Invoice Contract OCR Manager.

## Development workflow

1. Fork the repository and create a feature branch.
2. Keep changes focused and easy to review.
3. Do not commit private documents, invoices, contracts, ledgers, databases, logs, or screenshots containing business data.
4. Run the relevant checks before opening a pull request.

## Backend checks

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m compileall .
```

## Frontend checks

```bash
cd frontend
npm install
npm run build
npm run lint
```

## Pull request expectations

A good pull request should include:

- A short description of the problem and solution.
- Testing notes.
- Screenshots only when they are fully redacted and safe to publish.
- Documentation updates when behavior changes.

## Privacy requirements

Never submit real invoices, contracts, receipts, company names, tax IDs, bank details, signatures, personal information, or production database files. Use synthetic fixtures or fully redacted samples.

## Areas that need help

- English-first UI and optional localization.
- OCR quality improvements.
- Structured test fixtures.
- CI and packaging.
- Security hardening for local file handling.
