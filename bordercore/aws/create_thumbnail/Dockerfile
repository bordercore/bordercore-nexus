FROM public.ecr.aws/lambda/python:3.13

# Copy requirements.txt
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install fonts for text thumbnails and Python dependencies
RUN dnf install -y dejavu-sans-fonts && dnf clean all
RUN pip install -r requirements.txt

# Copy function code
RUN mkdir ${LAMBDA_TASK_ROOT}/lib
COPY lib/util.py ${LAMBDA_TASK_ROOT}/lib/
COPY lib/thumbnails.py ${LAMBDA_TASK_ROOT}/lib/
COPY create_thumbnail_lambda.py ${LAMBDA_TASK_ROOT}

# Copy static ffmpeg binary
COPY ffmpeg-6.0-amd64-static/ffmpeg /usr/local/bin

# Set the CMD to your handler
CMD [ "create_thumbnail_lambda.handler" ]
