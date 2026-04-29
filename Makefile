EC2_HOST=ec2
EC2_PATH=/var/www/django/static/
MAX_AGE=2592000
PYTHON=.venv/bin/python3
ELASTICSEARCH_INDEX_TEST=bordercore_test
ELASTICSEARCH_ENDPOINT_TEST=http://localhost:9201
MAPPINGS=$(BORDERCORE_HOME)/../config/elasticsearch/mappings.json


export env_var := MyEnvVariable

install:
	pip install --upgrade pip && pip install -r requirements.txt

.ONESHELL:
.SILENT:
vite: vite_build vite_ec2

vite_build: check-env
	cd $(BORDERCORE_HOME)
	npm run vite:build

vite_ec2: vite_build check-env
	set -e
	cd $(BORDERCORE_HOME)
	test -f static/vite/.vite/manifest.json || { echo "ERROR: static/vite/.vite/manifest.json missing; refusing to rsync --delete"; exit 1; }
	rsync -azv --no-times --no-group --delete --exclude=/rest_framework static/vite/ $(EC2_HOST):$(EC2_PATH)vite/
	ssh $(EC2_HOST) "sudo chown -R www-data:www-data $(EC2_PATH)vite/"
	ssh $(EC2_HOST) "mkdir -p $(EC2_PATH)../bordercore/bordercore/static/vite/.vite && sudo chown -R www-data:www-data $(EC2_PATH)../bordercore/bordercore/static/vite"
	scp ./static/vite/.vite/manifest.json $(EC2_HOST):$(EC2_PATH)../bordercore/bordercore/static/vite/.vite/manifest.json
	# Also copy to fallback location for compatibility
	scp ./static/vite/.vite/manifest.json $(EC2_HOST):$(EC2_PATH)../bordercore/bordercore/static/vite/manifest.json

admin_ec2:
	set -e
	ADMIN_SRC=$$($(PYTHON) -c "import django.contrib.admin, os; print(os.path.join(os.path.dirname(django.contrib.admin.__file__), 'static', 'admin'))")
	test -f "$$ADMIN_SRC/css/base.css" || { echo "ERROR: $$ADMIN_SRC does not contain expected Django admin assets; refusing to rsync --delete"; exit 1; }
	rsync -azv --no-times --no-group --delete "$$ADMIN_SRC/" $(EC2_HOST):$(EC2_PATH)admin/
	ssh $(EC2_HOST) "sudo chown -R www-data:www-data $(EC2_PATH)admin/"

check-env:
ifndef BORDERCORE_HOME
	$(error BORDERCORE_HOME is undefined)
endif

test:
	python -m pytest -vv --cov=lib --cov=cli tests/*.py

test_data:
	$(PYTHON) $(BORDERCORE_HOME)/../bin/test_runner.py --test data

test_unit:
	MOCK_ELASTICSEARCH=1 \
	$(PYTHON) $(BORDERCORE_HOME)/../bin/test_runner.py --test unit

test_wumpus:
	$(PYTHON) $(BORDERCORE_HOME)/../bin/test_runner.py --test wumpus

test_functional:
	MOCK_ELASTICSEARCH=1 \
	$(PYTHON) $(BORDERCORE_HOME)/../bin/test_runner.py --test functional

test_coverage:
	MOCK_ELASTICSEARCH=1 \
	$(PYTHON) $(BORDERCORE_HOME)/../bin/test_runner.py --test coverage


reset_elasticsearch:
# Delete the Elasticsearch test instance and re-populate its mappings
	curl --no-progress-meter -XDELETE "$(ELASTICSEARCH_ENDPOINT_TEST)/$(ELASTICSEARCH_INDEX_TEST)/" > /dev/null
	curl --no-progress-meter -XPUT $(ELASTICSEARCH_ENDPOINT_TEST)/$(ELASTICSEARCH_INDEX_TEST) -H "Content-Type: application/json" -d @$(MAPPINGS) > /dev/null
