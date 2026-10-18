# Results JSON Payload Compatibility

## Goal

Accept the supplied race-results JSON without requiring frontend-side payload
changes, and keep the API's event/result response envelopes predictable.

## Input contract

`POST /api/results` accepts the payload at the JSON root:

- `event_title`: non-empty event title.
- `event_slug`: slug string; the empty string is valid and must be preserved
  exactly as sent. Do not derive a slug from the title.
- `total_results`: non-negative integer matching the number of entries in
  `results`.
- `results`: race-result objects using the supplied snake_case field names.

Each result retains validation for its required identity/category/status/gender
fields, nullable optional category rank and time/team fields, valid race-time
format, and unique bib number within the imported event. The supplied payload
contains 116 results and uses `MASCULINO`/`FEMININO`, `C`/`L`, and null
`rank_category` values; these values must be accepted.

Import continues to replace the active event and its results in one database
transaction. The response reports the imported count and event metadata. The
database's unique event slug remains valid because the replacement operation
maintains one active event; the empty value is stored as provided.

## Read routes

Preserve the existing response envelopes:

- `GET /api/results`: `{ event, pagination, results }`
- `GET /api/results/{bibNumber}`: `{ event, result }`

Use snake_case event metadata in both routes: `event_title`, `event_slug`,
`total_results`, and `imported_at`. Result objects continue to use the supplied
snake_case field names. Pagination behavior and filters remain unchanged.

`GET /health` and `POST /api/results/reset` retain their existing behavior and
response shapes; they do not consume event payloads.

## Validation and errors

Keep the current JSON size limit, rate limiting, CORS policy, and error
responses. Invalid payloads return the existing 422 validation response.
Database failures must remain visible through the existing 500 error handling;
the import must not report success unless the transaction completes.

## Tests and acceptance criteria

- Schema tests parse the complete supplied JSON, including the empty slug,
  116 results, null ranks, and all current enum-like values.
- Route/service tests verify that importing replaces the event atomically and
  that the read routes return the stated envelopes and snake_case metadata.
- A real HTTP import using the supplied file must return success and
  `imported_count: 116`.
- Read back every page and compare all event/result fields with the input;
  confirm the stored slug is exactly empty and the total is 116.
- Verify an unknown bib returns 404, `/health` remains healthy, and `/reset`
  behavior is unchanged. Since import replaces existing data, perform the
  authorized import against the configured database and do not reset it after
  verification.
