# Open Source Release Checklist

## Before publishing

- [ ] Review all files listed by `git add --dry-run .`.
- [ ] Confirm that no real invoices, contracts, receipts, Excel ledgers, OCR outputs, customer names, tax IDs, addresses, signatures, bank data, or production databases are included.
- [ ] Confirm that `config.json` is not committed.
- [ ] Confirm that `archive/`, `archive_invoices/`, `uploads/`, `scratch/`, `python_env/`, `frontend/node_modules/`, `frontend/dist/`, and `sql_app.db*` are ignored.
- [ ] Confirm the selected license is acceptable for the project.
- [ ] Replace placeholder values in `docs/openai-codex-for-oss-application.md`.

## Local Git commands

```bash
git status --short --ignored
git add --dry-run .
git add .
git commit -m "Prepare project for open-source release"
```

## Create the GitHub repository

Create a public repository named:

```text
invoice-contract-ocr-manager
```

Recommended description:

```text
Local-first OCR document manager for invoices, contracts, receipts, archives, and Excel ledger workflows.
```

Recommended topics:

```text
fastapi react vite ocr rapidocr invoice contract document-management sqlite excel open-source
```

## Push to GitHub

Replace `<YOUR_GITHUB_USERNAME>` before running:

```bash
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/invoice-contract-ocr-manager.git
git push -u origin main
```

## After publishing

- [ ] Confirm the repository is public.
- [ ] Confirm your GitHub profile visibility is public.
- [ ] Check that GitHub Actions runs successfully.
- [ ] Add the repository URL to the Codex for Open Source application form.
- [ ] Submit accurate usage/adoption information. If the project is new, explain ecosystem importance honestly.
