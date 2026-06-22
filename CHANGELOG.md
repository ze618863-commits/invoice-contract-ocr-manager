# Changelog

All notable changes to this project will be documented in this file.

This project follows a simple release format inspired by [Keep a Changelog](https://keepachangelog.com/) and uses semantic versioning where practical.

## Unreleased

### Added

- README badges for CI, CodeQL, license, and release status.
- CodeQL workflow for Python and JavaScript security analysis.
- Dependabot configuration for Python, npm, and GitHub Actions updates.
- Pytest-based test skeleton for configuration, schemas, and synthetic examples.

### Changed

- CI now runs backend tests in addition to compile and frontend build checks.

## v0.1.0 - Initial open-source release

### Added

- FastAPI backend for OCR-assisted invoice and contract workflows.
- React frontend for document upload, review, classification, and management.
- Example configuration file for safe local setup.
- GitHub Actions CI workflow for backend and frontend checks.
- MIT license.
- Contribution guidelines.
- Security policy.
- Code of conduct.
- Open-source release checklist.
- OpenAI Codex for OSS application draft.

### Security

- Excluded local databases, uploads, archived documents, private configuration, virtual environments, build outputs, and compressed archives from version control.

### Notes

- This is the first public open-source release.
- Some UI labels and domain-specific fields may still need English-first cleanup in future releases.
