// Shared dataset metadata block (the release manifest here, and the private website and API
// build in shipportx-web-api).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPERATING_STATUSES, CONFIDENCE_LEVELS, SOURCE_DATA_DIR } from './dataset.mjs';

export function buildMetadata({ payload, config, dataFiles, checksums, stats }) {
  return {
    dataset: payload.dataset,
    version: payload.version,
    schema_version: payload.schema_version,
    generated: payload.generated,
    research_cutoff_date: payload.research_cutoff_date,
    record_count: payload.record_count,
    release_prepared: config.release_prepared,
    description: config.description,
    license: config.license,
    formats: dataFiles.map((f) => ({ file: f, sha256: checksums[f], bytes: readFileSync(join(SOURCE_DATA_DIR, f)).length })),
    vocabularies: {
      operating_status: OPERATING_STATUSES,
      research_status: ['VERIFIED', 'RESEARCHED', 'DISCOVERED', 'UNRESOLVED'],
      confidence: CONFIDENCE_LEVELS,
      port_type_primary: stats.port_type_primary.map((x) => x.value).filter(Boolean),
      commercial_status_primary: stats.commercial_status_primary.map((x) => x.value).filter(Boolean),
      region_continental: stats.regions.map((x) => x.value),
    },
    derived_fields: {
      port_type_primary: 'From the original flat exports: first token of port_type with parenthetical qualifiers removed. Convenience value, not a research fact.',
      operating_status_primary: 'From the original flat exports: operating_status normalised to the controlled vocabulary. Convenience value, not a research fact.',
      commercial_status_primary: 'Added in the v1.0.0 release package using the same rule as port_type_primary, for filtering. Convenience value, not a research fact.',
    },
    quality_flags:
      'Release-level annotations from automated checks (e.g. published coordinates that disagree with the research text). They describe suspected problems; published values are never altered. See docs/validation in the release.',
    missing_values: {
      null: 'Not established in this research pass. Not zero, not "none".',
      UNKNOWN: 'Explicit research conclusion that the value could not be determined despite an attempt.',
      NONE: 'Positive finding that the thing does not exist (where used).',
    },
  };
}
