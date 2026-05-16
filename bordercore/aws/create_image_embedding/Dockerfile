FROM public.ecr.aws/lambda/python:3.10

COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

RUN mkdir -p ${LAMBDA_TASK_ROOT}/lib ${LAMBDA_TASK_ROOT}/models
COPY lib/ ${LAMBDA_TASK_ROOT}/lib/
COPY models/ ${LAMBDA_TASK_ROOT}/models/
COPY create_image_embedding_lambda.py ${LAMBDA_TASK_ROOT}

CMD [ "create_image_embedding_lambda.handler" ]
