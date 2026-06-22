# Architecture

Invoice Contract OCR Manager is a local-first OCR-assisted document automation application for invoices, contracts, receipts, delivery notes, and related business documents.

## Components

- React and Vite frontend
- FastAPI backend
- SQLite metadata database
- Local file storage
- OCR and AI post-processing workflow

## Workflow

1. Upload a document.
2. Store the file locally.
3. Extract text with OCR.
4. Classify the document and extract structured fields.
5. Review and correct results.
6. Save metadata to SQLite.
7. Organize the document into the local archive.

## Design Goals

- Local-first document handling
- No private data committed to Git
- Contributor-friendly architecture
- Extensible OCR provider design
- Synthetic examples for public development
