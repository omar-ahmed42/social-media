#!/bin/bash

if [[ ! -z "$CASSANDRA_KEYSPACE" && $1 = 'cassandra' ]]; then
  # Create default keyspace for single node cluster
  CQL="CREATE KEYSPACE $CASSANDRA_KEYSPACE WITH REPLICATION = {'class': 'SimpleStrategy', 'replication_factor': 3}  AND durable_writes = true;CREATE TABLE $CASSANDRA_KEYSPACE.conversation_message (conversation_id bigint, message_id timeuuid, content text, created_at timestamp, sender_id bigint, attachment map<text, text>, PRIMARY KEY (conversation_id, message_id)) WITH CLUSTERING ORDER BY (message_id DESC);"
  until echo $CQL | cqlsh; do
    echo "cqlsh: Cassandra is unavailable - retry later"
    sleep 2
  done &
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"