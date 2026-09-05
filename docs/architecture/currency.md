# Workspace currency

The workspace uses Indian rupees (INR) only. UI totals and inputs use the rupee symbol
and Indian digit grouping; PDF documents use ASCII `INR` for standard-font compatibility.
Spreadsheet currency columns are explicitly labeled INR. Shared formatters live in
`src/lib/money.ts` and are re-exported through the existing feature formatting APIs.

This maintainer-requested change reinterprets the local workspace amounts as INR without
an exchange-rate conversion or database rewrite. Legacy `*Cents` fields remain integer
hundredths, now paise (100 = INR 1), preserving arithmetic and API compatibility. This is
not a historical USD-to-INR financial conversion. Saved numeric values are unchanged.

Multi-currency pricing and exchange-rate management are not implemented. Any future
rollout needs explicit currency snapshots and migration decisions rather than changing
this formatter alone.

Verified through formatter tests, PDF/XLS artifact tests and quotation/catalog browser flows.
