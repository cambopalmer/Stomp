# Stage 01: Architecture

## Inputs
- `../00-prd/output/prd.md`
- `../_config/decisions/adr-0001-stack.md`
- `../_config/decisions/adr-0002-datastore.md`

## Process
1. Describe the runtime topology (processes, ports, volumes).
2. Define the monorepo layout and each package's responsibility.
3. Define the API layering and request lifecycle.
4. Define the deployment model: local container now, cheap host later.
5. Define the dynamic sitemap approach.
6. List cross-cutting concerns: config, logging, error handling, auth seam.

## Outputs
- `output/architecture.md`

## Review gate
User confirms topology and deployment model. ADRs updated if anything changes.
