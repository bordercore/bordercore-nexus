#!/usr/bin/env python3
# encoding: utf-8

from lxml import html
from lxml.etree import ParserError, XMLSyntaxError
from random import randint
import time

import django
from django.utils import timezone
import requests

django.setup()


def get_link_info(link):
    headers = {'user-agent': 'Bordercore/1.0'}
    r = requests.get(link, headers=headers, timeout=10)

    status_code = r.status_code
    if status_code != requests.codes.ok:
        raise IOError(status_code)

    http_content = r.text.encode('utf-8')

    # http://stackoverflow.com/questions/15830421/xml-unicode-strings-with-encoding-declaration-are-not-supported
    # parser = etree.XMLParser(ns_clean=True, recover=True, encoding='utf-8')
    # doc = fromstring(http_content, parser=parser)
    doc = html.fromstring(http_content)
    title = doc.xpath('.//title')
    if title is not None and len(title) > 0:
        return title[0].text
    else:
        return "No title"

from bookmark.models import Bookmark

# Get an ad-hoc link
# links = Bookmark.objects.filter(pk=11017)

# Get links with no titles (ie the url is the title) and has never been checked
# links = Bookmark.objects.filter(Q(title__icontains='http://') & Q(last_response_code__isnull=True)).order_by('created')

# Get links that have never been checked
links = Bookmark.objects.filter(last_response_code__isnull=True).order_by('modified')

for link in links:

    # Skip links with not null "daily" fields, since they generate unexplained "django.db.utils.ProgrammingError: can't adapt type 'dict'" errors
    if link.id == 1144:
        continue

    print("{} {} {}".format(link.created.strftime("%m-%d-%Y"), link.id, link.title))
    m = True

    if m:
        try:
            title = get_link_info(link.url)
            link.last_response_code = requests.codes.ok
            print("  OK: %s" % title)
        except (IOError, ParserError, XMLSyntaxError) as e:
            status = e.args[0]
            print("  NOT OK: %s" % status)
            if isinstance(status, int):
                link.last_response_code = status
    link.last_check = timezone.now()
    link.save()

    time.sleep(randint(0, 5) + 1)
