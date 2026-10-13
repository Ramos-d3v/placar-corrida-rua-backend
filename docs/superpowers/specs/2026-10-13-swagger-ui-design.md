# Swagger UI Design

## Goal

Provide an interactive API reference at `GET /swagger` so a client can inspect
and try the running results API.

## Scope

- Serve Swagger UI from the API itself; do not rely on an external CDN.
- Document `GET /health`, `POST /api/results`, `POST /api/results/reset`,
  `GET /api/results`, and `GET /api/results/{bibNumber}`.
- Describe request fields, query filters, pagination, result payloads, and
  representative success and error responses.
- Include realistic example payloads for result import and reset.
- Explicitly document that POST routes are public and have no credential
  requirement. Warn that importing replaces the current event/results and
  reset deletes all event/result data.
- Keep current API route behavior unchanged.

## Implementation approach

Add a self-hosted Swagger UI dependency and an OpenAPI 3.x document maintained
in the repository. Mount the UI at `/swagger`, pointing it at the API's
OpenAPI document. Keep the API base URL relative to the current origin so the
Try it out feature targets the same server that serves the UI.

## Validation

- Confirm `/swagger` returns the interactive documentation and its OpenAPI
  document can be loaded.
- Confirm the document describes all existing routes, schemas, status codes,
  and destructive/public POST behavior.
- Run the existing test suite and lint.
- Exercise a documented request against the local API where safe, and leave
  the database in its original empty/demo state after any write test.
