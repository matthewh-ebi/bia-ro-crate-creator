# BIA RO-Crate Editor

Client-side editor for creating BIA submission RO-Crates. Create study metadata,
authors, publications, funding and REMBI components (BioSample, specimen
preparation, image acquisition, annotation methods), link them through
datasets, and export a crate that loads in the
[BIA RO-Crate Explorer](https://github.com/matthewh-ebi/bia-ro-crate-explorer).
Drafts are autosaved to browser localStorage only.

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # Vitest
pnpm typecheck
pnpm build
```

## Architecture

```
schema/biaSchema.ts  ── declarative type specs (fields, relations, IRIs, requirements)
        │
model/draft.ts       ── Draft = entities (literals only) + relationships (ordered edges); pure reducer
model/checks.ts      ── live completeness checks (mirrors the explorer profile, metadata-only)
export/buildCrate.ts ── pure Draft → RO-Crate JSON-LD + file-list declaration
export/zip.ts        ── <folder>/ro-crate-metadata.json + header-only file_list.tsv
store/, views/       ── React UI reading the draft via context
```

- Adding a field or relation means editing `biaSchema.ts`. Forms, checks and
  export all pick it up. A test asserts every key exists in the BIA `@context`.
- Internal uids never leave the editor. Each `@id` is the external IRI (ORCID,
  ROR, DOI, NCBI taxon) if one is set, otherwise a minted `#<prefix>-<slug>`.
- Deleting an entity cascades to its edges, so the draft can't contain
  dangling references.

## Not yet supported

- Importing existing crates
- Editing file-list rows (the export contains only the header)
- Controlled-vocabulary validation
