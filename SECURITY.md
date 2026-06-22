# Security Policy

## Supported versions

Security fixes are handled on the main branch until the project adopts formal release branches.

## Reporting a vulnerability

Please report security issues privately to the maintainers instead of opening a public issue. Include:

- A clear description of the issue.
- Reproduction steps.
- Affected files, endpoints, or workflows.
- Whether private documents, local files, or database records may be exposed.

## Data sensitivity

This application processes invoices, contracts, receipts, OCR text, file paths, and Excel ledgers. These may contain confidential business information. Do not include real business documents, screenshots, logs, databases, or extracted text in public issues or pull requests.

## Local deployment assumptions

The current application is designed for local use. Before exposing it to a network or multi-user environment, review authentication, authorization, CORS, file upload validation, path traversal protections, rate limits, logging, backup handling, and database access.
