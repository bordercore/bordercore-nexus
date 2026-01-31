EC2_HOST=ec2
EC2_PATH=/var/www/django/static/
MAX_AGE=2592000
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
	cd $(BORDERCORE_HOME)
	rsync -azv --no-times --no-group --delete --exclude=/rest_framework static/vite/ $(EC2_HOST):$(EC2_PATH)vite/
	ssh $(EC2_HOST) "sudo chown -R www-data:www-data $(EC2_PATH)vite/"
	ssh $(EC2_HOST) "mkdir -p $(EC2_PATH)../bordercore/bordercore/static/vite/.vite && sudo chown -R www-data:www-data $(EC2_PATH)../bordercore/bordercore/static/vite"
	scp ./static/vite/.vite/manifest.json $(EC2_HOST):$(EC2_PATH)../bordercore/bordercore/static/vite/.vite/manifest.json
	# Also copy to fallback location for compatibility
	scp ./static/vite/.vite/manifest.json $(EC2_HOST):$(EC2_PATH)../bordercore/bordercore/static/vite/manifest.json

check-env:
ifndef BORDERCORE_HOME
	$(error BORDERCORE_HOME is undefined)
endif

test:
	python -m pytest -vv --cov=lib --cov=cli tests/*.py

test_data:
	python3 $(BORDERCORE_HOME)/../bin/test_runner.py --test data

test_unit:
	MOCK_ELASTICSEARCH=1 \
	python3 $(BORDERCORE_HOME)/../bin/test_runner.py --test unit

test_wumpus:
	python3 $(BORDERCORE_HOME)/../bin/test_runner.py --test wumpus

test_functional:
	MOCK_ELASTICSEARCH=1 \
	python3 $(BORDERCORE_HOME)/../bin/test_runner.py --test functional

test_coverage:
	MOCK_ELASTICSEARCH=1 \
	python3 $(BORDERCORE_HOME)/../bin/test_runner.py --test coverage


reset_elasticsearch:
# Delete the Elasticsearch test instance and re-populate its mappings
	curl --no-progress-meter -XDELETE "$(ELASTICSEARCH_ENDPOINT_TEST)/$(ELASTICSEARCH_INDEX_TEST)/" > /dev/null
	curl --no-progress-meter -XPUT $(ELASTICSEARCH_ENDPOINT_TEST)/$(ELASTICSEARCH_INDEX_TEST) -H "Content-Type: application/json" -d @$(MAPPINGS) > /dev/null
