#!/bin/bash

BUCKET=bordercore-blobs
IMAGE_REPO=192218769908.dkr.ecr.us-east-1.amazonaws.com/create-image-embedding-lambda
TEMPLATE_FILE=packaged.yaml
SAM=~/.local/bin/sam
SECURITY_GROUP=sg-bfa013fe
SUBNET=subnet-09460047abea1c3bd

$SAM build --use-container &&

$SAM package \
     --s3-bucket $BUCKET \
     --image-repository $IMAGE_REPO \
     --output-template-file packaged.yaml &&

$SAM deploy \
     --template-file $TEMPLATE_FILE \
     --stack-name CreateImageEmbeddingStack \
     --capabilities CAPABILITY_IAM \
     --image-repository $IMAGE_REPO \
     --parameter-overrides ParameterKey=ElasticsearchEndpointParameter,ParameterValue=$ELASTICSEARCH_ENDPOINT \
     ParameterKey=ElasticsearchIndexParameter,ParameterValue=$ELASTICSEARCH_INDEX \
     ParameterKey=StorageBucketNameParameter,ParameterValue=$AWS_STORAGE_BUCKET_NAME \
     ParameterKey=SecurityGroupParameter,ParameterValue=$SECURITY_GROUP \
     ParameterKey=SubnetParameter,ParameterValue=$SUBNET
