.PHONY: ci-test coverage

ci-test:
	python -m pytest backend/tests/ --cov=backend --cov-fail-under=60

coverage:
	python -m pytest backend/tests/ --cov=backend --cov=.coveragerc
