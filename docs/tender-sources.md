# Tender sources and review policy

Neba imports tender notices only from official or authoritative public sources. Imports always enter the operations review queue and are never published automatically.

## Active connectors

| Source | Scope | Integration |
| --- | --- | --- |
| Nigeria Open Contracting Portal (NOCOPO) | Federal Nigerian public procurement | The BPP's OCDS export is downloaded as compressed JSONL. Only tender releases with a future deadline and an official document URL are queued. |
| World Bank Procurement Notices | Global, including Nigeria | The World Bank's public procurement-notices JSON API is queried. Only notices with a future deadline and official detail URL are queued. |

The existing AfDB RSS opportunity import remains enabled. It classifies procurement, tender, and RFQ items as tenders when the source provides them.

## Source controls

- `TENDER_NOCOPO_URL` can replace the default NOCOPO export URL when a new yearly dataset is published.
- `TENDER_WORLD_BANK_URL` can replace the World Bank API query.
- `TENDER_FETCH_LIMIT` caps each import run (default 20, maximum 50).
- `python manage.py fetch_tenders --source nocopo|world-bank|all --limit 20` runs the import manually.

The scheduled operations fetch runs every six hours and invokes both the existing opportunity importer and the tender importer. Imported notices retain their official source URL, are marked `pending`, and require staff confirmation of deadline, eligibility, requirements, and application instructions.

## Next connectors to assess

State e-procurement portals and UNGM should be added only after confirming their public data access, permitted use, stable detail URLs, and a field mapping that preserves each portal's official notice link.
