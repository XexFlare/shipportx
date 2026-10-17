# Contributing to ShipPortX

Thank you for helping improve an open dataset of African ports. The most valuable contributions
are **corrections and additions backed by a public source**.

## Ways to contribute

| You want to… | Do this |
|---|---|
| Fix a wrong value (status, coordinates, UN/LOCODE, authority, …) | Open a **Data correction** issue. |
| Add a port, harbour, landing site or terminal that is missing | Open a **Missing port** issue. |
| Report a problem with files, docs, scripts or the API | Open a **Documentation or tooling** issue. |
| Submit the change yourself | Open a pull request (see below). |

## What makes a good report

- The `port_id` (e.g. `GH-tema`), or for a new port: name, country, nearest
  settlement and, if possible, coordinates.
- The field, the current value and the value you believe is correct.
- **A public source**: ideally Tier 1 (port/harbour authority, fisheries or transport ministry,
  official gazette, concession or impact-assessment document, UNECE UN/LOCODE). Specialist
  databases and reputable press are also useful; encyclopedias and aggregators help discovery
  but are not enough alone.
- For numbers (draft, berths, throughput): the **year** the figure refers to.

Being small or poorly documented is never a reason to leave a facility out, a fishing landing
with a jetty belongs in ShipPortX as much as a container port.

## How corrections are made

The data files are generated from the maintainers' research records, so please report changes as
issues rather than editing `data/` directly. A maintainer checks the source, updates the research
record and the controlled vocabularies (`docs/SCHEMA.md`, `docs/PROVENANCE.md`), and releases a
new version of the files.

Never estimate or infer values a source does not state; `UNKNOWN` is an acceptable answer.

## Conduct

Be respectful and assume good faith. Disagreements about facts are settled by evidence; where
credible sources genuinely disagree, the dataset records the conflict (`CONFLICTING`) rather than
picking a side.
