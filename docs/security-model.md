# Security Model

Invoice Contract OCR Manager handles uploaded documents, OCR output, local metadata, and configuration files. Invoices and contracts may contain sensitive business data, so security review is important.

## Main Risks

- Unsafe file upload handling
- Path traversal
- Oversized or unsupported files
- Accidental commit of private documents
- Leaked API keys or local configuration
- Vulnerable dependencies
- Unsafe archive paths
- Future authentication and authorization gaps

## Current Controls

- Runtime data is excluded through .gitignore
- config.json is ignored
- config.example.json is provided
- CodeQL security scanning is enabled
- Dependabot dependency maintenance is enabled
- CI checks run on GitHub Actions
- Synthetic examples are used instead of real documents

## Future Work

- Add file type validation tests
- Add upload size limits
- Add path traversal regression tests
- Add safer deployment documentation
- Add authentication guidance for multi-user deployments
