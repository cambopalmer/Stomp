# ICM conventions for this workspace

Based on Jake Van Clief's **Interpretable Context Methodology** (ICM): folder structure *is* the orchestration; a single agent reads the right files at the right moment; humans review between stages.

## Five-layer context hierarchy

| Layer | File(s) | Purpose |
|---|---|---|
| 0 | `planning/IDENTITY.md`, root `CLAUDE.md` | System identity + orientation |
| 1 | `planning/CONTEXT.md` | Routing across stages |
| 2 | `planning/NN-stage/CONTEXT.md` | Stage contract: inputs / process / outputs |
| 3 | `planning/_config/*` | Stable reference: conventions, glossary, ADRs |
| 4 | `planning/NN-stage/output/*` | Run artifacts: the actual deliverables |

## Stage contract (`CONTEXT.md`) format

```markdown
# Stage NN: <name>
## Inputs      — files to read, and why
## Process     — numbered, sequential steps
## Outputs     — files to write, location, format
## Review gate — what the human checks before the next stage
```

## Rules

1. **One stage, one job.** Architecture doesn't design the schema; the schema stage doesn't plan the roadmap.
2. **Plain markdown only.** Every artifact is human-editable.
3. **Load only what the stage needs.** Don't pull all of Layer 3/4 at once.
4. **Every output is an edit surface.** The human accepts / edits / re-runs before proceeding.
5. **Configure once, reuse.** `_config/` is set once and reused across build cycles.

## Numbering

- Planning stages: `00`–`06`.
- Add `_index.md` to any `_config/` subfolder once it exceeds ~10 files.
- New ADRs: `_config/decisions/adr-NNNN-slug.md`, incrementing.
