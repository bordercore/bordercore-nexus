"""pytest sys.path setup for this Lambda's tests.

This file adds the Lambda directory to sys.path so the tests can use
`from lib.elasticsearch_indexer import ...` rather than the longer
`from bordercore.aws.index_blobs.lib.elasticsearch_indexer import ...`.

There are two ways to run these tests:

1. Normal dev use — let this conftest do its work:
       cd bordercore/aws/index_blobs
       pytest tests/

2. CI / isolated runs that need to avoid the repo's outer conftest
   (which pulls in Django + boto3): use PYTHONPATH instead of conftest:
       cd bordercore/aws/index_blobs
       PYTHONPATH=$(pwd) pytest tests/ --noconftest --override-ini='addopts='
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
