# ShipPortX HTTP API

A free, public, read-only JSON API. It serves the v1.0.0 records in `data/` for Africa and, for
the rest of the world, ports from the NGA World Port Index (public domain US government data).
No key, no sign-up; CORS allows any origin. The API source code and deployment configuration ship
separately from this data repository (see the ShipPortX release package, `api/`).

**Credit:** "Port data: ShipPortX (Africa), NGA World Port Index (worldwide)".

Replace `<api-host>` with the deployed host.

## Coverage

Every record has a `source` and a `scope`:

| `source` | `scope` | What it is |
|---|---|---|
| `shipportx` | `africa` | The researched, source-cited ShipPortX records (this dataset). |
| `wpi` | `world` | World Port Index ports outside Africa. |
| `wpi` | `africa` | African World Port Index ports that ShipPortX does not have yet. |

ShipPortX wins for Africa: when a World Port Index port matches a ShipPortX record (same UN/LOCODE,
or close by with a similar name), only the ShipPortX record is served and the World Port Index
number is kept in `wpi_port_numbers`. World Port Index ids are `WPI-<number>`.

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Status, dataset version and record counts. |
| `GET /api/v1/ports` | Search, filter and paginate ports. |
| `GET /api/v1/ports/index` | Every port as compact rows, for client-side search and maps. |
| `GET /api/v1/ports/{id}` | One port. ShipPortX records include the full research record. Case-insensitive id. |
| `GET /api/v1/countries` | Countries with `record_count`, `shipportx_count`, `wpi_count`, `verified_count`, `with_coordinates`. |
| `GET /api/v1/metadata` | Version, dates, file checksums, vocabularies, statistics, field completeness, worldwide index details. |

**`client` parameter:** every endpoint accepts `client=<your app name>` (letters, digits, `.`,
`-`, `_`, at most 40 characters), e.g. `client=shipclass`. It never changes the response; it lets
usage be told apart per app. Please send it.

### `GET /api/v1/ports` parameters

| Parameter | Description |
|---|---|
| `q` | Case- and accent-insensitive substring search over name, alternate names, id, UN/LOCODE and (ShipPortX) city and administrative area. Max 100 characters. |
| `country` | ISO2 (`KE`) or name (`Kenya`); ISO3 (`KEN`) for ShipPortX records. |
| `source` | `shipportx` or `wpi`. |
| `scope` | `africa` or `world`. |
| `cargo` | Comma separated, all must match: `container`, `dry_bulk`, `liquid_bulk`, `break_bulk`, `roro`, `oil`, `gas`, `passenger`, `fishing`. Most World Port Index cargo flags are "unknown", so this under-reports `wpi` ports. |
| `min_draft` | Maximum vessel draft of at least this many metres (0 to 30). Ports without a known draft are excluded. |
| `ocean_going` | `true` or `false`. Heuristic: depth or draft of at least 7 m, otherwise port type (ShipPortX) or a medium or large harbour (World Port Index). Unknown ports match neither. |
| `port_type` | ShipPortX `port_type_primary` (e.g. `lake_port`, `fishing_harbour`) or World Port Index harbour type (`coastal_natural`, `coastal_breakwater`, `coastal_tide_gate`, `river_natural`, `river_basin`, `river_tide_gate`, `lake_or_canal`, `open_roadstead`, `typhoon_harbor`). |
| `region` | ShipPortX only, e.g. `East Africa`. |
| `operating_status` | ShipPortX only: `ACTIVE`, `ACTIVE_LIMITED`, `SEASONAL`, `INACTIVE`, `HISTORICAL`, `UNDER_CONSTRUCTION`, `PROPOSED`, `ABANDONED`, `UNKNOWN`. |
| `commercial_status` | ShipPortX only, e.g. `commercial`, `artisanal`, `mixed`, `industrial_private`. |
| `research_status` | ShipPortX only: `VERIFIED`, `RESEARCHED`, `DISCOVERED`, `UNRESOLVED`. |
| `has_coordinates`, `has_unlocode` | `true` or `false`. |
| `page` | Default 1. Pages beyond the end return an empty `data` array. |
| `limit` | 1 to 100, default 25. |

Filters combine with AND. Unknown parameters are rejected with `400 unknown_parameter`.

`GET /api/v1/ports/index` accepts `source` and `scope` only.

## Examples

```bash
curl "https://<api-host>/api/health"
curl "https://<api-host>/api/v1/ports?q=lagos&client=myapp"
curl "https://<api-host>/api/v1/ports?q=rotterdam"
curl "https://<api-host>/api/v1/ports?country=TZ&port_type=lake_port&limit=50"
curl "https://<api-host>/api/v1/ports?scope=africa&cargo=container&min_draft=12"
curl "https://<api-host>/api/v1/ports?ocean_going=true&country=BR"
curl "https://<api-host>/api/v1/ports/index?scope=africa"
curl "https://<api-host>/api/v1/ports/GH-tema"
curl "https://<api-host>/api/v1/countries?scope=africa"
```

```js
const res = await fetch('https://<api-host>/api/v1/ports?country=NG&limit=100&client=myapp');
const { data, meta, links } = await res.json();
console.log(meta.total, data.map((p) => p.name));
```

```python
import requests
r = requests.get("https://<api-host>/api/v1/ports", params={"country": "MZ", "port_type": "fishing_harbour", "client": "myapp"})
r.raise_for_status()
print(r.json()["meta"]["total"])
```

## Responses

```json
{
  "data": [{ "id": "KE-mombasa", "name": "Port of Mombasa", "country": "Kenya", "country_code": "KE",
             "latitude": -4.0475, "longitude": 39.635, "unlocode": "KEMBA",
             "source": "shipportx", "scope": "africa", "port_type": "seaport", "harbor_size": null,
             "max_draft_m": 15, "channel_depth_m": null, "cargo": ["container", "dry_bulk", "liquid_bulk", "break_bulk"],
             "ocean_going": true, "operating_status": "ACTIVE", "research_status": "VERIFIED",
             "alternate_names": "...", "wpi_port_numbers": [47100] }],
  "meta": { "total": 1, "count": 1, "page": 1, "limit": 25, "total_pages": 1,
            "filters": { "q": "mombasa" }, "dataset_version": "1.0.0",
            "credit": "Port data: ShipPortX (Africa), NGA World Port Index (worldwide)" },
  "links": { "self": "...", "first": "...", "last": "...", "prev": null, "next": null }
}
```

List records use one schema for both sources. `harbor_size` is World Port Index only;
`operating_status` and `research_status` are ShipPortX only; unknown values are `null`.

`GET /api/v1/ports/{id}` returns the same record plus `shipportx`: for ShipPortX records, the
full research record (every dataset field, `fields_detail`, resolved `sources`, the derived
`*_primary` fields and `quality_flags` from automated checks); `null` for World Port Index records.

`GET /api/v1/ports/index` returns `{ "fields": ["id", "name", "country_code", "latitude",
"longitude", "unlocode", "source", "ocean_going"], "data": [[...], ...], "meta": {...} }`.

### Errors

```json
{ "error": { "status": 400, "code": "invalid_parameter", "message": "'limit' must be between 1 and 100.", "details": { "parameter": "limit", "value": "500" } } }
```

| Status | Code |
|---|---|
| 400 | `invalid_parameter`, `unknown_parameter` |
| 404 | `port_not_found`, `route_not_found` |
| 405 | `method_not_allowed` (only GET, HEAD, OPTIONS) |
| 500 | `internal_error` |

## Usage logging and privacy

Each call is counted for the maintainer's usage statistics: time, endpoint, port id, search text
and filters, `client`, the calling site (host of the `Origin` or `Referer` header) and the
visitor's country. IP addresses, user agents and cookies are not stored. Raw call records are
deleted after 90 days; only daily totals are kept longer.

## Fair use

There are no keys or rate-limit tiers, but the API runs on a hosting plan with monthly limits.
Responses are cached; for bulk work download the files in `data/` instead of paging through
the entire API repeatedly.
