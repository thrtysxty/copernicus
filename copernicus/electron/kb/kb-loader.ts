// Story 566 — KB Content Storage: Startup Upsert Logic
// STUB: Full implementation delivered by Jules

/**
 * Reads all Markdown files from copernicus/resources/kb/ and upserts them
 * into the intelligence_documents table (source='curated').
 * Matched on `id` frontmatter; updated only if `version` is higher.
 */
export async function loadKbContent(): Promise<void> {
  // TODO (Story 566): implement glob + frontmatter parse + upsert loop
}
