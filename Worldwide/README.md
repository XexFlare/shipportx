# ShipPortX worldwide port index

`ports-worldwide.json` is generated. Do not edit it by hand.

It merges the ShipPortX dataset (Africa, researched) with the NGA World Port Index (worldwide,
public domain) and is served by the ShipPortX API. The published ShipPortX dataset in `../Data`
stays Africa-only.

**Credit:** "Port data: ShipPortX (Africa), NGA World Port Index (worldwide)".

## Rebuild

```bash
python scripts/import_wpi.py        # only when a fresh WPI snapshot is wanted (writes External/wpi/)
python scripts/build_dataset.py     # after editing the ShipPortX-Research repo
python scripts/build_worldwide.py   # writes Worldwide/ and reports/worldwide_merge_report.json
python -m unittest discover scripts
```

Builds read the newest snapshot in `External/wpi/`, never the live WPI API, so they are reproducible.

## Merge rule

- ShipPortX research wins for Africa. A matching WPI port is dropped and its number kept in
  `wpi_port_numbers`; WPI values never overwrite ShipPortX values.
- Matching: same UN/LOCODE; else a same-country ShipPortX record within 10 km with a similar name;
  else the nearest one within 3 km. Separate terminals a few km from a city port stay separate.
- WPI fills the rest of the world, plus African ports ShipPortX does not have (`scope: "africa"`,
  `source: "wpi"`).
- Gaps WPI could fill in ShipPortX records are listed in `reports/wpi_research_leads.json` as
  leads for the normal research process.

## Record fields

`id` (ShipPortX `port_id` or `WPI-<number>`), `name`, `alternate_names`, `country`, `country_code`,
`latitude`, `longitude`, `unlocode`, `source` (`shipportx` | `wpi`), `scope` (`africa` | `world`),
`port_type`, `harbor_size` (WPI only), `max_draft_m`, `channel_depth_m`, `cargo` (tags:
container, dry_bulk, liquid_bulk, break_bulk, roro, oil, gas, passenger, fishing), `ocean_going`,
`operating_status` and `research_status` (ShipPortX only), `wpi_port_numbers`.

`ocean_going` is a heuristic: known depth or draft of at least 7 m, otherwise the port type
(ShipPortX) or a medium or large harbour (WPI); `null` when unknown. Most WPI cargo flags are
"unknown", so the `cargo` filter under-reports WPI ports.
