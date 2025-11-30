"""Script to invoke the SnarfFavicon Lambda function.

This module provides a command-line script to manually trigger the AWS Lambda
function that downloads and stores favicon images for websites. It invokes
the Lambda function asynchronously to fetch and save favicons.
"""

import argparse
import json
import pprint

import boto3

client = boto3.client("lambda")


def invoke(url: str, parse_domain: bool) -> None:
    """Invoke the SnarfFavicon Lambda function to fetch a favicon.

    Invokes the Lambda function asynchronously to download and store a
    favicon for the given URL. The function can optionally parse the
    domain from the URL or use the full URL as-is.

    Args:
        url: URL string of the website whose favicon should be fetched.
        parse_domain: If True, extract and use only the domain from the URL.
            If False, use the full URL as the identifier.
    """

    payload = {
        "url": url,
        "parse_domain": parse_domain
    }

    response = client.invoke(
        ClientContext="MyApp",
        FunctionName="SnarfFavicon",
        InvocationType="Event",
        LogType="Tail",
        Payload=json.dumps(payload)
    )

    pprint.PrettyPrinter(indent=4).pprint(response)


if __name__ == "__main__":

    parser = argparse.ArgumentParser()
    parser.add_argument("--parse_domain", "-p", default=True,
                        help="should we parse the domain from the url?",
                        action="store_true")
    parser.add_argument("--url", "-u", type=str, required=True,
                        help="the url whose favicon you want to snarf")

    args = parser.parse_args()

    parse_domain = args.parse_domain
    url = args.url

    invoke(url, parse_domain)
