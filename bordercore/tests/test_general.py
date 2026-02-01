import os
import re

import pytest
from bs4 import BeautifulSoup

import django
from django.conf import settings

pytestmark = pytest.mark.data_quality

django.setup()


def test_html():
    """
    Look for HTML that violates best practices, such as inline styles
    and temporary attributes.
    """

    # Collect all the templates used by Django or React
    template_list = []
    dir_list = [
        settings.TEMPLATES[0]["DIRS"],
        [f"{os.environ['BORDERCORE_HOME']}/front-end/react"]
    ]

    for template_dir in ([item for sublist in dir_list for item in sublist]):
        for base_dir, dirnames, filenames in os.walk(template_dir):
            for filename in filenames:
                template_list.append(os.path.join(base_dir, filename))

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

                # Look for inline styles
                assert not re.search(r"style=\{", line), f"Found inline CSS style in React component {template} at line {i+1}"

                # Look for className starting with underscore
                assert not re.search(r"className=[\"'\{]\s*_", line), f"Found a class name starting with '_' in React component {template} at line {i+1}"

                # Look for _className attribute
                assert not re.search(r"_className=", line), f"Found a tag with attribute name '_className' in React component {template} at line {i+1}"

        else:
            # HTML templates (Django)
            with open(template, "r") as file:
                page = file.read().replace("\n", "")

            soup = BeautifulSoup(page, "lxml")

            # Look for any inline CSS styles, ie a tag with a "style" attribute
            count = soup.find_all(attrs={"style": True})

            # If there is only one violation and it occurs in the "body"
            #  tag, assume it's the inline background-image style,
            #  which we're accepting for now for lack of a better place
            #  to put it, given the STATIC_URL Django variable used.
            if len(count) == 1 and "body" in [x.name for x in count]:
                continue

            assert len(count) == 0, f"Found inline CSS style in template {template}"

            # Look for any tag with a "_class" attribute
            count = soup.find_all(attrs={"_class": True})

            assert len(count) == 0, f"Found a tag with attribute name '_class' in template {template}"

            # Look for any class names that start with an underscore
            divs = soup.select("div[class^='_']")

            # This hack discards classes formed by Django conditional logic, which might contain
            #  underscores that are perfectly fine.
            count = [x for x in divs if "{%" not in x.attrs["class"]]

            assert len(count) == 0, f"Found a class name starting with '_' in template {template}"
