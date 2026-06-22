# Roadmap

This roadmap describes the near-term direction for Invoice Contract OCR Manager. The project is intentionally scoped as a local-first, open-source document automation tool for invoices, contracts, and related business records.

## v0.1.x - Open-source stabilization

- Keep the repository safe for public collaboration.
- Improve setup documentation for Windows and local development.
- Add anonymized fixtures and sample OCR outputs.
- Improve CI coverage for backend and frontend checks.
- Document common troubleshooting steps.
- Track remaining English-first documentation and UI cleanup.

## v0.2.x - Extraction quality and tests

- Improve OCR post-processing for invoice and contract fields.
- Add backend API tests for upload, classification, review, and export workflows.
- Add frontend smoke tests for key user flows.
- Improve error handling and validation messages.
- Introduce clearer domain models for invoices, contracts, counterparties, and review status.

## v0.3.x - Contributor-friendly architecture

- Document backend API boundaries and data flow.
- Add pluggable OCR provider interfaces.
- Add export templates for common accounting and review workflows.
- Improve configuration management for local and team deployments.
- Add contribution guides for new document types and extraction rules.

## Longer-term ideas

- Multi-language UI support.
- Role-based review workflows.
- More structured import and export pipelines.
- Integrations with external storage systems.
- Optional AI-assisted document summarization and quality checks.

## Non-goals

- The project should not include real invoices, contracts, private business records, database files, or local credentials.
- The project should not require a hosted service for basic local use.
- The project should avoid vendor lock-in where practical.
