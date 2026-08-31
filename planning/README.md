# planning/ — how to navigate

This is an **ICM workspace** (Interpretable Context Methodology). Read stages in order; each has a `CONTEXT.md` contract and an `output/` folder holding the deliverable.

```
planning/
├── PLAN.md                     ← master plan, read first
├── IDENTITY.md                 ← Layer 0: what STOMP is
├── CONTEXT.md                  ← Layer 1: stage routing
├── 00-prd/                     ← PRD: why we're building, for whom, requirements
├── 01-architecture/            ← stack, deployment, ADRs
├── 02-data-model/              ← the schema (technical centerpiece)
├── 03-ui-ux/                   ← screens, IA, sitemap
├── 04-integrations/            ← email/calendar adapters (designed, not built)
├── 05-delivery/                ← roadmap + dogfood backlog
├── 06-gaps-and-questions/      ← OPEN QUESTIONS — clear before building
└── _config/                    ← conventions, glossary, decision log
```

**Review gate:** nothing gets built until `06-gaps-and-questions/output/open-questions.md` is resolved with the user.
