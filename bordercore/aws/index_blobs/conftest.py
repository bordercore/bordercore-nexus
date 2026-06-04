"""pytest setup for this Lambda's tests.

The Lambda's ``lib/`` modules are build artifacts: ``control.sh build`` copies
the canonical sources (``bordercore/lib/util.py`` and
``bordercore/blob/elasticsearch_indexer.py``) into ``lib/`` before packaging.
They are gitignored, so this conftest reproduces that copy before tests run —
tests always exercise the same canonical code the build ships.

It also adds the Lambda directory to sys.path so the tests can use
``from lib.elasticsearch_indexer import ...`` rather than the longer
``from bordercore.aws.index_blobs.lib.elasticsearch_indexer import ...``.

There are two ways to run these tests:

1. Normal dev use — let this conftest do its work:
       cd bordercore/aws/index_blobs
       pytest tests/

2. CI / isolated runs that need to avoid the repo's outer conftest
   (which pulls in Django + boto3): use PYTHONPATH instead of conftest, but
   run ``control.sh build``'s copy step first so ``lib/`` is populated:
       cd bordercore/aws/index_blobs
       cp ../../lib/util.py ./lib/
       cp ../../blob/elasticsearch_indexer.py ./lib/
       PYTHONPATH=$(pwd) pytest tests/ --noconftest --override-ini='addopts='
"""
import shutil
import sys
from pathlib import Path

_LAMBDA_DIR = Path(__file__).resolve().parent
_BORDERCORE_DIR = _LAMBDA_DIR.parents[1]
_LIB_DIR = _LAMBDA_DIR / "lib"

# Mirror control.sh build(): copy canonical sources into the Lambda's lib/.
_CANONICAL_SOURCES = {
    _BORDERCORE_DIR / "lib" / "util.py": _LIB_DIR / "util.py",
    _BORDERCORE_DIR / "blob" / "elasticsearch_indexer.py": _LIB_DIR / "elasticsearch_indexer.py",
}

_LIB_DIR.mkdir(exist_ok=True)
for source, dest in _CANONICAL_SOURCES.items():
    shutil.copyfile(source, dest)

sys.path.insert(0, str(_LAMBDA_DIR))
