import logging
import os
import re

import boto3
import botocore
import requests

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)

bucket_name = os.environ.get("BUCKET_NAME")
favicon_key = "django/img/favicons"

s3_resource = boto3.resource("s3")

MAX_AGE = 2592000


def get_domain(url):

    p = re.compile(r"https?://(.*?)/")
    m = p.match(url)

    if m:
        domain = m.group(1)
        parts = domain.split(".")
        # We want the domain part of the hostname (eg npr.org instead of www.npr.org)
        if len(parts) == 3:
            domain = ".".join(parts[1:])
    else:
        raise Exception(f"Can't parse domain from url: {url}")

    return domain


def handler(event, context):

    try:

        url = event["url"]
        parse_domain = event.get("parse_domain", True)

        logging.info(f"Snarfing favicon for {url}")

        if parse_domain:
            domain = get_domain(url)
        else:
            domain = url

        try:

            # Check to see if the favicon already exists
            s3_resource.Object(bucket_name, f"{favicon_key}/{domain}.ico").load()

        except botocore.exceptions.ClientError:

            # Favicon does not exist. Attempt to snarf it.
            logging.info(f"Uploading new favicon to S3: {domain}")

            r = requests.get(f"http://{domain}/favicon.ico", timeout=10)
            if r.status_code != 200:
                raise Exception(f"Error: status code for {domain} was {r.status_code}")

            if len(r.content) == 0:
                raise Exception(f"favicon image size is zero for {domain}")

            object = s3_resource.Object(bucket_name, f"{favicon_key}/{domain}.ico")
            object.put(Body=r.content, ACL="public-read", CacheControl=f"max-age={MAX_AGE}")

        log.info("Lambda finished")

    except Exception as e:
        log.error(f"Lambda Exception: {e}")
