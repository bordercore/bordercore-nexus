FROM public.ecr.aws/lambda/python:3.13

# Copy requirements.txt
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install the specified packages
RUN pip install -r requirements.txt

# Copy function code
RUN mkdir ${LAMBDA_TASK_ROOT}/lib
COPY lib/util.py ${LAMBDA_TASK_ROOT}/lib/
COPY lib/thumbnails.py ${LAMBDA_TASK_ROOT}/lib/
COPY create_bookmark_thumbnail_lambda.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "create_bookmark_thumbnail_lambda.handler" ]
