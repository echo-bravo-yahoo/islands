Confirmed to work on node 17

### To-do
- Dynamically adapt to changes in location from MQTT (the application currently doesn't see those changes and continues to emit/subscribe to the old location MQTT topics)

### Logging cookbook
- Pretty logs: `node index.js | pino-pretty`
- Pretty logs for only one tag (in this case, "shadow"): `node index.js | jq 'select(.tags | index( "shadow" ))' | pino-pretty`
