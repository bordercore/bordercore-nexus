import os
import re

import pytest
from bs4 import BeautifulSoup

from django.conf import settings

pytestmark = [pytest.mark.data_quality]


def test_html():
    """Verify templates and React components have no inline styles or temp attributes."""

    bordercore_home = os.environ.get("BORDERCORE_HOME")
    if not bordercore_home:
        pytest.skip("BORDERCORE_HOME not set")

    # Collect all the templates used by Django or React
    template_list = []
    template_dirs = [d for engine in settings.TEMPLATES for d in engine.get("DIRS", [])]
    template_dirs.append(f"{bordercore_home}/front-end/react")

    for template_dir in template_dirs:
        for base_dir, _, filenames in os.walk(template_dir):
            for filename in filenames:
                template_list.append(os.path.join(base_dir, filename))

    violations = []

    for template in template_list:

        if template.endswith(".tsx") or template.endswith(".jsx"):
            # React components
            with open(template, "r") as file:
                lines = file.readlines()

            for i, line in enumerate(lines):
                # Skip if current line or previous line has the exclusion comment
                if "must remain inline" in line:
                    continue
                if i > 0 and "must remain inline" in lines[i-1]:
                    continue

                if re.search(r"style=\{", line):
                    violations.append(f"Inline CSS style in React component {template} at line {i+1}")

                if re.search(r"className=[\"'\{]\s*_", line):
                    violations.append(f"Class name starting with '_' in React component {template} at line {i+1}")

                if re.search(r"_className=", line):
                    violations.append(f"Attribute '_className' in React component {template} at line {i+1}")

        else:
            # HTML templates (Django)
            with open(template, "r") as file:
                page = file.read().replace("\n", "")

            soup = BeautifulSoup(page, "lxml")

            # Look for any inline CSS styles, ie a tag with a "style" attribute
            styled = soup.find_all(attrs={"style": True})

            # If there is only one violation and it occurs in the "body"
            #  tag, assume it's the inline background-image style,
            #  which we're accepting for now for lack of a better place
            #  to put it, given the STATIC_URL Django variable used.
            if not (len(styled) == 1 and "body" in [x.name for x in styled]):
                if styled:
                    violations.append(f"Inline CSS style in template {template}")

            # Look for any tag with a "_class" attribute
            if soup.find_all(attrs={"_class": True}):
                violations.append(f"Attribute '_class' in template {template}")

            # Look for any class names that start with an underscore
            elements = soup.select("[class^='_']")

            # Discard classes formed by Django conditional logic, which might contain
            #  underscores that are perfectly fine.
            underscore_hits = [x for x in elements if not any("{%" in cls for cls in x.get("class", []))]

            if underscore_hits:
                violations.append(f"Class name starting with '_' in template {template}")

    assert not violations, "Template quality violations found:\n" + "\n".join(violations)
