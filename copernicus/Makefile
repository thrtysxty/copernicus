.PHONY: ci-test coverage ci-coverage rc-check dist

ci-test:
	python -m pytest backend/tests/ --cov=backend --cov-fail-under=60

coverage:
	python -m pytest backend/tests/ --cov=backend --cov-report=term-missing

ci-coverage:
	python -m pytest backend/tests/ --cov=backend --cov-fail-under=65 -q
	-npm run test -- --coverage --reporter=verbose || true

dist:
	npm run dist

rc-check:
	@echo "=== [1/6] TSC ==="
	@npx tsc --noEmit || (echo "RC CHECK FAILED at step 1/6 (TSC)"; exit 1)
	@echo ""
	@echo "=== [2/6] pytest ==="
	@python -m pytest backend/tests/ -q || (echo "RC CHECK FAILED at step 2/6 (pytest)"; exit 1)
	@echo ""
	@echo "=== [3/6] vitest (electron + utils, no renderer) ==="
	@npx vitest run --exclude "**/src/renderer/**" || (echo "RC CHECK FAILED at step 3/6 (vitest)"; exit 1)
	@echo ""
	@echo "=== [4/6] coverage ==="
	@python -m pytest backend/tests/ --cov=backend --cov-fail-under=65 -q || (echo "RC CHECK FAILED at step 4/6 (coverage)"; exit 1)
	@echo ""
	@echo "=== [5/6] Playwright ==="
	@npx playwright test || (echo "RC CHECK FAILED at step 5/6 (Playwright)"; exit 1)
	@echo ""
	@echo "=== [6/6] dist ==="
	@npm run dist || (echo "RC CHECK FAILED at step 6/6 (dist)"; exit 1)
	@echo ""
	@echo "RC CHECK PASSED — Copernicus v1 ready"
