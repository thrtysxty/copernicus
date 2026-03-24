cat copernicus/electron/db/schema.ts | sed 's/context_json    TEXT/context_json    TEXT,\n      prompt_id       TEXT,\n      commit_sha      TEXT/' > copernicus/electron/db/schema.ts.new
mv copernicus/electron/db/schema.ts.new copernicus/electron/db/schema.ts
