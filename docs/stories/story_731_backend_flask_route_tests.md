# User Story 731: Backend Flask Route Tests — Stories and Docs Endpoints

**Status:** APPROVED FOR IMPLEMENTATION
**Priority:** P1
**Type:** Test Coverage

## Blocks:
(none)

## Blocked By:
(none)

## Goal

Add route-level integration tests for the two Flask blueprints (`stories_bp`, `docs_bp`) registered in `backend/app/__init__.py`. Tests use the Flask test client via `create_app('testing')`.

## Files in Scope

- `copernicus/backend/tests/test_stories_routes.py` (new)
- `copernicus/backend/tests/test_docs_routes.py` (new)
- `copernicus/backend/app/__init__.py` (read-only — for `create_app` factory)
- `copernicus/backend/app/stories.py` (read-only — for route paths and expected responses)
- `copernicus/backend/app/docs.py` (read-only — for route paths and expected responses)

## Acceptance Criteria

1. Read `backend/app/stories.py` and `backend/app/docs.py` first — write ACs against routes that actually exist
2. `test_stories_routes.py` covers:
   - `GET /stories` returns 200 with a JSON list (may be empty)
   - `POST /stories` with required fields returns 201 and story object
   - `GET /stories/<id>` returns 200 for existing story, 404 for missing
   - `PUT /stories/<id>` updates and returns updated object
3. `test_docs_routes.py` covers:
   - `GET /docs` returns 200
   - At least 2 meaningful endpoint tests based on actual routes in `docs.py`
4. All tests use `self.app = create_app('testing')` and `self.client = self.app.test_client()`
5. `make test` (from `copernicus/copernicus/`) runs all tests and passes

## Notes

- Do not assume column names or fields — read the model/blueprint files first
- If `create_app('testing')` needs DB setup, look at the pattern in existing test files under `backend/tests/`
- Scope: only routes that exist in the blueprint. Do not add new routes.
