#!/bin/bash

# Disable the AWS CLI v2 pager so `aws` never blocks on `less` under a TTY
# (e.g. when run via `script -qc`); otherwise control.sh can hang after the call.
export AWS_PAGER=""

IMAGE_REPO=192218769908.dkr.ecr.us-east-1.amazonaws.com/create-collection-thumbnail-lambda
FUNCTION=CreateCollectionThumbnail
LAMBDA=create-collection-thumbnail-lambda
TAG=latest


build() {

    cp ../../lib/util.py ./lib/

    docker build -t $LAMBDA:$TAG .

    docker rmi $IMAGE_REPO

    docker tag $LAMBDA:$TAG $IMAGE_REPO:$TAG

    docker push $IMAGE_REPO:$TAG

    exit 0
}

run() {

    docker run -p 9000:8080 --rm $LAMBDA:$TAG

    exit 0

}

update() {

    aws lambda update-function-code --function-name $FUNCTION --image-uri $IMAGE_REPO:$TAG

    exit 0
}

usage() {
    echo "Usage: $0 [-b] [-r] [-u]"
    echo "  -b: build and push image"
    echo "  -r: run lambda docker image"
    echo "  -u: update lambda"
    exit 1
}

# Parse command-line arguments
while getopts "bru" opt; do
    case "$opt" in
        b) build ;;
        r) run ;;
        u) update ;;
        \?) echo "Invalid option: -$OPTARG" >&2 ; usage ;;
    esac
done

echo "Error: At least one argument (-b or -r or -u) must be specified."
usage
