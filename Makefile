.PHONY: up down migrate seed test-backend logs build-ext

up:
	docker compose up --build -d

down:
	docker compose down -v

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python -m app.scripts.seed_user

test-backend:
	docker compose exec backend pytest tests/ -v

logs:
	docker compose logs -f

build-ext:
	cd extension && npm install && npm run build
