FROM python:3.8 as base

ARG database_password
ARG git_host
ARG git_password
ARG secret_key

ENV GIT_ASKPASS=/git_env_password.sh

RUN echo "#!/bin/bash\necho $git_password" > /git_env_password.sh && \
    chmod a+x /git_env_password.sh

RUN git clone http://git@$git_host/git/bordercore.git/

WORKDIR /bordercore
RUN git config pull.rebase false
RUN git config --global user.email "testuser@bordercore.com"
RUN git config --global user.name "Test User"

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
RUN uv sync --group dev

WORKDIR /bordercore/bordercore

# Install npm packages and generate JavaScript bundle
RUN apt update && apt install -y npm firefox-esr xvfb
RUN npm init -y
RUN npm install
RUN npm run dev-jenkins

RUN wget https://github.com/mozilla/geckodriver/releases/download/v0.31.0/geckodriver-v0.31.0-linux64.tar.gz -O - |tar -xz && \
    mkdir -p /opt/bin && \
    mv geckodriver /opt/bin

# These environment variables are used when the container
#  is run to perform the test suite.
ENV DJANGO_LOG_DIR=/tmp
ENV BORDERCORE_HOME=/bordercore/bordercore
ENV DJANGO_SETTINGS_MODULE=config.settings.dev
ENV PYTHONPATH=/bordercore/bordercore:/bordercore
ENV DATABASE_PASSWORD=$database_password
ENV SECRET_KEY=$secret_key

COPY run-tests.sh .

ENTRYPOINT sh run-tests.sh
