Confirmed to work on node 17

### Logging cookbook
- Pretty logs: `node index.js | pino-pretty`
- Pretty logs for only one tag (in this case, "shadow"): `node index.js | jq 'select(.tags | index( "shadow" ))' | pino-pretty`
