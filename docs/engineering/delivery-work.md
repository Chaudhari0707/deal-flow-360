# Delivery work and phase ownership

Project: [DealFlow360 local delivery](https://linear.app/odoohack/project/dealflow360-local-hackathon-delivery-d599cf252a3b).

| Phase | Issue | Owner | Scope |
| --- | --- | --- | --- |
| 0 | DF-5 | 0monish / Linear team owner | Contracts, schema, local environment and integration |
| 1 | DF-6 | jay3chauhan | Identity, shell, customer portal |
| 1 | DF-7 | 0monish | Catalog, quote pricing and governance |
| 1 | DF-8 | MitvaVirvadiya | Stock, fulfillment, realtime |
| 1 | DF-9 | Chaudhari0707 | Billing, subscriptions, PDFs and reporting |
| 2 | DF-10 | jay3chauhan | Browser integration and access regressions |
| 2 | DF-11 | MitvaVirvadiya | Concurrency, recovery and capacity |
| 3 | DF-12 | 0monish | CodeRabbit, refutation and security corrections |
| 3 | DF-13 | Chaudhari0707 | Demo and understandable architecture handoff |

The maintainer authorized a shared integration branch with exclusive file ownership, recorded in the
issues. The coordinator alone stages/commits/pushes, owns shared schema and package changes, and
creates chronological phase PRs. Commits use the supplied contributor identities and describe the
concrete changes and validation. Metadata-only corrections preserve code snapshots, contributor
identities and timestamps. Prior foundation is `dev` at `6728ed8`.

Promotion follows feature PR → `dev` → `prod` (production) → `main`. Run the applicable gates before each
promotion; these are Git branches and do not imply a hosted deployment. The first foundation commit
used the configured 0monish identity; subsequent feature commits carry the assigned workstream author.

After each phase, record actual checks and outstanding acceptance in Linear. An issue is Done only
when its acceptance was exercised. External blockers are documented for later review, not reported as
passing. Local-only delivery does not prove another operating system or hosted production capacity.
