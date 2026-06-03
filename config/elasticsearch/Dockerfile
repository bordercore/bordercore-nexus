FROM elasticsearch:8.17.1

ENV ES_JAVA_OPTS="-Xms512m -Xmx512m"

# This disables a security warning.
ENV ES_SETTING_XPACK_SECURITY_ENABLED="false"

# ingest-attachment ships as a bundled module in ES 8.x — no plugin install needed.
