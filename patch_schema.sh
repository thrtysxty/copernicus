#!/bin/bash
sed -i '' -e '/preferred_model TEXT,/i\
      section     TEXT,\
      tags        TEXT,\
      source      TEXT NOT NULL DEFAULT '"'curated'"',\
      version     INTEGER NOT NULL DEFAULT 1,\
      excerpt     TEXT,
' copernicus/electron/db/schema.ts
