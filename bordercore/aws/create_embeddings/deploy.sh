#!/bin/bash

BUCKET=bordercore-blobs
IMAGE_REPO=192218769908.dkr.ecr.us-east-1.amazonaws.com/create-embeddings-lambda
TEMPLATE_FILE=packaged.yaml
SAM=~/.local/bin/sam
SECURITY_GROUP=sg-bfa013fe
SUBNET=subnet-09460047abea1c3bd

# Sync shared library files into the build context (these are gitignored;
# the canonical copies live at bordercore/lib/). Keep this in step with
# control.sh so SAM and direct-Docker builds produce identical images.
cp ../../lib/embeddings.py ./lib/ &&

$SAM build --use-container &&

$SAM package \
     --s3-bucket $BUCKET \
     --image-repository $IMAGE_REPO \
     --output-template-file packaged.yaml &&

$SAM deploy \
     --template-file $TEMPLATE_FILE \
     --stack-name CreateEmbeddingsStack \
     --capabilities CAPABILITY_IAM \
     --image-repository $IMAGE_REPO \
     --parameter-overrides ParameterKey=DRFTokenParameter,ParameterValue=$DRF_TOKEN \ ParameterKey=ElasticsearchEndpointParameter,ParameterValue=$ELASTICSEARCH_ENDPOINT \
     ParameterKey=OpenaiApiKeyParameter,ParameterValue=$OPENAI_API_KEY \
     ParameterKey=SecurityGroupParameter,ParameterValue=$SECURITY_GROUP \
     ParameterKey=SubnetParameter,ParameterValue=$SUBNET
