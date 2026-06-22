# Sample Documents

This directory is reserved for synthetic and anonymized examples that help contributors understand the expected invoice and contract workflows.

## Privacy rule

Do not commit real invoices, contracts, payment records, company seals, addresses, phone numbers, tax identifiers, identity documents, database files, credentials, or other private business data.

## Example invoice fields

A typical synthetic invoice fixture may include:

- Vendor name
- Customer name
- Invoice number
- Invoice date
- Due date
- Currency
- Total amount
- Tax amount
- Payment terms
- Line items
- Review status

## Example contract fields

A typical synthetic contract fixture may include:

- Contract title
- Counterparty
- Effective date
- Expiration date
- Renewal terms
- Payment terms
- Contract value
- Responsible reviewer
- Review status

## Synthetic example

```json
{
  "document_type": "contract",
  "title": "Example Service Agreement",
  "counterparty": "Example Partner LLC",
  "effective_date": "2026-01-01",
  "expiration_date": "2026-12-31",
  "contract_value": 24000,
  "currency": "USD",
  "review_status": "needs_review"
}
```

Synthetic examples should be small, clear, and safe to share publicly.
