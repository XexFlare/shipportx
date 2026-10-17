# RESEARCH-ShipPortX

Project-specific research instructions for **ShipPortX**. Ports and regularly used port facilities across Africa.

This specification applies the project's general research methodology (evidence hierarchy, confidence levels, field-level provenance) to ports. **This is v4 of the specification, superseding the previous version.**

v3's correction: discovery breadth and research depth are separate axes, and depth must never gate breadth (§0).

v4's correction: **there is no "candidate" concept and no exclusion-by-unimportance.** Once an entity is confirmed to actually be a real port/harbour/terminal/landing facility within scope, it goes into the dataset. Permanently, not provisionally. "Candidate," "INCLUDED," and "EXCLUDED" (for anything other than a genuine non-qualifying entity) are retired terms; see §10. v4 also runs continent-wide discovery as one continuous pass rather than country-by-country batches with sign-off between steps; see §14.

---

## 0. Core Principle (read this first)

**The objective is the most comprehensive practical dataset of African ports we can build. Not a list of Africa's major, commercially important, or well-documented ports.**

ShipPortX must actively try to discover and include the long tail: secondary and regional ports, fishing harbours, river ports, lake ports, industrial/oil/gas/mining/agricultural export terminals, passenger and ferry ports, private ports, and other small but regularly-used maritime facilities. Not only the handful of ports that show up in a "major ports of [country]" search.

The pipeline is:

```text
DISCOVER → IDENTIFY → CLASSIFY → VERIFY STATUS/ACTIVITY → INCLUDE → RESEARCH AS DEEPLY AS PRACTICAL
```

**How much is known about a port determines how complete its record is. It never determines whether the port belongs in the dataset.**

Concretely:

- Do NOT reason "few sources exist, therefore defer or exclude this port."
- DO reason "few sources exist, therefore this port's record will be short."
- A record with nothing but `name`, `country`, `coordinates` (or at least a named settlement), `port_type`, `operating_status`, and one source is a **valid, complete-enough ShipPortX record**. It is not a placeholder to be embarrassed about.
- `UNKNOWN` is a first-class value, not a failure state. Never omit a field silently and never fabricate one to avoid writing `UNKNOWN`.
- "Small," "poorly documented," and "not internationally famous" are never, by themselves, exclusion reasons.

Breadth first, depth second. But once discovered and included, research every port as deeply as practical evidence allows.

---

## 1. Dataset Scope

ShipPortX catalogs ports and regularly used port facilities on the African continent (including island nations, and inland lake/river ports). Commercial, industrial, fishing, passenger, or other significant maritime/waterborne activity.

This is an **operationally defined, actively-growing reference dataset**, not a legal or exhaustive claim, and not a "top ports" list. We are asserting: every entity in the dataset is real, has credible evidence of existing and of some level of current or recent use, and every field we report has a traceable source. We are not asserting the dataset is complete, nor are we limiting it to entities that happen to be easy to research.

### 1.1 What "regularly used" (or "currently relevant") means

An entity qualifies for inclusion if there is credible evidence that it is a real port/harbour/terminal facility and is **not purely historical, abandoned, or a bare offshore waiting point**. This bar is intentionally low. It is a filter against dead/fictional/anchorage-only entries, not a filter for size or fame. Evidence of qualifying status includes any of:

- Listed by a national port, maritime, transport, or fisheries authority (at any tier of that authority's own hierarchy: main commercial ports and minor "scheduled" or "gazetted" ports alike).
- Has an assigned UN/LOCODE.
- Reported by any credible source (including local news, NGO logistics assessments, environmental/impact studies, concession documents, or industry directories) as handling cargo, vessels, fishing catch, or passengers within a reasonable recency window. As a rule of thumb the last ~15–20 years, longer for facilities with no reported closure.
- Is a scheduled stop for a ferry, coastal shipping, or passenger line.
- Is a licensed or locally-recognized fishing harbour, landing site, or jetty with dedicated infrastructure (a quay, jetty, slipway, or landing structure). Even a small one. A wholly informal beach landing with zero built infrastructure and zero authority recognition is the one clear case that stays out (see §3).
- Is a single-commodity export/import terminal (oil, gas, ore, salt, grain, minerals) with evidence of having operated, even briefly, or currently under active development toward operation.
- Is a river or lake port/landing serving cargo, passenger, or fishing traffic on an African inland waterway.

If a facility's only evidence is a purely historical reference (a colonial-era gazetteer, a 19th-century atlas) with no indication it ever operated within living memory, classify it `HISTORICAL` (§1.2) rather than `ACTIVE`: but it may still be recorded, not merely excluded, if it is a real, identifiable place (see §3).

### 1.2 Operating Status vocabulary (controlled)

Every port record carries one `operating_status` value from this list:

| Status | Meaning |
|---|---|
| `ACTIVE` | Currently operating at its normal/described scale |
| `ACTIVE_LIMITED` | Operating, but only partially (e.g. a subset of planned berths built/open, reduced capacity) |
| `SEASONAL` | Operates only part of the year by design (e.g. weather/monsoon-dependent) |
| `INACTIVE` | Exists, evidence of past use, but no credible evidence of current activity; not confirmed permanently closed |
| `HISTORICAL` | Was once a functioning port; credible evidence it no longer operates as one (repurposed, silted up, superseded) |
| `UNDER_CONSTRUCTION` | Being built; not yet handling regular traffic |
| `PROPOSED` | Planned/announced but construction not confirmed to have started |
| `ABANDONED` | Physically derelict with no plausible reactivation signal |
| `UNKNOWN` | Existence is credible but current status could not be established within budget |

`INACTIVE`, `HISTORICAL`, `UNDER_CONSTRUCTION`, `PROPOSED`, and `ABANDONED` entities ARE part of the dataset (clearly labeled as such). They are not excluded, because distinguishing "this is real but not currently an active port" from "this is an active port" is itself a core purpose of ShipPortX (see §0 and the master goal of an honest, non-overstated dataset). They must never be presented as `ACTIVE`.

---

## 2. Scope Criteria: what counts as a ShipPortX entity

There are no "candidates" in ShipPortX. Once research confirms an entity actually is a real port, harbour, terminal, landing facility, or other maritime/waterborne facility within scope, it is recorded in the dataset. This is a permanent classification decision, not a provisional one subject to later removal for being unimportant. Add an entity to the dataset if BOTH:

1. It is a real, identifiable place with at least a name and a location (coordinates, or failing that, a named settlement/coastline/riverbank segment) established by a credible source, AND
2. It falls into one of the categories in §1.1, OR is a berth/jetty/terminal/harbour/landing structure that plainly exists for maritime or waterborne cargo, fishing, or passenger purposes (even if currently `INACTIVE`, `HISTORICAL`, `UNDER_CONSTRUCTION`, `PROPOSED`, or `ABANDONED` per §1.2).

There is no minimum size, throughput, fame, commercial significance, or documentation-depth threshold, and **being small, poorly documented, fishing-only, or of "limited commercial activity" is never a reason to leave an entity out.** A single-jetty fishing landing with a local government or fisheries-ministry mention belongs in the dataset exactly as much as a major container port. The difference shows up in record depth (§8) and in the descriptive fields (`port_type`, `primary_activity`, `commercial_status`, scale), not in whether it's recorded at all.

## 3. What Is NOT In Scope

The only valid reason to leave something out of the dataset is that research establishes it is **not actually a port/harbour/facility within scope at all**. Not that it's small or unimportant. This applies to:

- **Pure anchorages/roadsteads** with no dedicated shore infrastructure (no berth, quay, jetty, or landing structure of any kind) and no independent name recognition as a "port." If named and functionally tied to a port's approach, record it as an attribute of that port (`approach_notes`), not a standalone entity.
- **Pure recreational marinas** with no commercial, fishing, or passenger function whatsoever.
- **Wholly informal beach landings** with zero built infrastructure (no jetty, slipway, quay, or structure of any kind) and zero recognition by any authority, directory, or published source beyond a passing mention that boats sometimes land there. (Note: a named fishing landing WITH a jetty/slipway/structure, or WITH any authority/fisheries-ministry recognition, does NOT meet this and belongs in the dataset: see §2.)
- **Naval-only military facilities** with no civilian port function and no public evidence of ever having one.
- **Fictional, unverifiable, or unlocatable "ports"**. I.e., entities where no credible source can even establish the place exists.

When something is determined to be genuinely out of scope for one of these reasons, log it in `exclusions/exclusions.md` with the specific reason, never simply dropped silently (master §20). This log should stay short. It is for things that turned out not to be ports at all, not a parking lot for small or under-documented ones.

---

## 4. Key Distinctions (apply carefully: see master §9 "Important Distinctions")

### Port vs. Terminal

A **port** is the overall complex/jurisdiction (usually under one port authority or one geographic harbour). A **terminal** is a discrete cargo-handling facility within a port (e.g., a container terminal, an oil terminal, a grain terminal).

- Default: model the port as one entity, and list its terminals as an attribute/sub-list within that port's record.
- Exception: create a terminal as its **own record** when it is geographically separate from the "parent" port, independently named, and commonly referred to as its own port/terminal by sources (e.g., Doraleh Container Terminal vs. the main Port of Djibouti). Record the relationship explicitly via `part_of` / `related_port`.
- This distinction governs how many *records* something produces. It must never be used as a reason to discard information. If in doubt between "separate record" and "sub-entry of a parent," default to recording it explicitly as a sub-entry rather than dropping it.

### Port vs. City

A city may contain, or be served by, more than one port/terminal (e.g., Lagos: Apapa and Tin Can Island as distinct entities). Don't merge distinct, separately-administered facilities just because they share a city; don't split one complex into many just because it has multiple berths.

### Port vs. Anchorage / Marina / Facility

See §3 for the (narrow) exclusions. Ferry terminals, industrial jetties, offshore mooring facilities with a shore installation, and small harbours are all in scope as their own entity type: see the taxonomy in §6.

### Active vs. Historical vs. Proposed vs. Unknown

See §1.2. Use the controlled vocabulary; never let a historical or proposed facility "masquerade" as `ACTIVE`, and never let uncertainty about status become a reason to drop the record instead of marking it `UNKNOWN`.

---

## 5. Duplicate and Alternate Name Handling

Ports frequently appear under multiple names: former colonial names, local-language names, transliterations, authority-official vs. commonly-used names, or renamed facilities.

- Before creating a new record, check that country's `discovered/<country>.md` register and `ports/<country>/` for an existing entity matching on name (incl. aliases), country, approximate location, and UN/LOCODE.
- Record all known alternate names in `alternative_names` rather than duplicating entities.
- If two sources might describe the same facility under different names and this can't be confirmed, record both in the discovery register as `UNRESOLVED` with a note explaining the possible overlap: don't silently merge or silently duplicate.
- If renamed, use the current official name as `port_name`, former name(s) under `alternative_names`.

---

## 6. Data Model / Schema

Required fields must be established, or explicitly `UNKNOWN`, for every included record. All other fields are populated only where credible evidence exists. Never estimated, calculated, or inferred beyond what a source states. Every non-obvious field carries confidence + source per master §4.

### IDENTITY
| Field | Notes | Required |
|---|---|---|
| `port_name` | Current/canonical name | Yes |
| `alternative_names` | Former/local/transliterated names | Where available |
| `unlocode` | UN/LOCODE | Where available |
| `country` | Country | Yes |
| `administrative_area` | Province/region/state | Where available |
| `nearby_city` / `settlement` | Nearest city, town, or village. For very small facilities this may be the only locator | Yes (settlement name at minimum) |
| `part_of` / `related_port` | Parent port if this is a separately-recorded terminal, or a related-facility note | Where applicable |

### CLASSIFICATION (new in v3: central to the long-tail goal)
| Field | Notes | Required |
|---|---|---|
| `port_type` | One primary category from: `major_commercial`, `secondary_commercial`, `regional_commercial`, `fishing_harbour`, `river_port`, `lake_port`, `oil_terminal`, `gas_terminal`, `mining_export_terminal`, `agricultural_export_terminal`, `passenger_port`, `ferry_terminal`, `industrial_port`, `private_port`, `naval_military` (civilian-use only, per §3), `terminal` (sub-entity of a parent port), `other` (specify) | Yes |
| `primary_activity` | The single dominant activity in plain terms, e.g. "container cargo," "artisanal + small-scale commercial fishing," "iron ore export," "passenger ferry to X" | Yes, may be `UNKNOWN` |
| `secondary_activities` | Any other activities credibly reported | Where available |
| `commercial_status` | `commercial`, `artisanal`, `mixed`, `industrial_private`, `unknown` | Yes, may be `UNKNOWN` |
| `operating_status` | Controlled vocabulary per §1.2 | Yes |

### LOCATION
| Field | Notes | Required |
|---|---|---|
| `latitude` / `longitude` | Coordinates, where a source gives them | Where available. If genuinely unpublished, record `UNKNOWN` and keep the named settlement/coastline description instead of dropping the record |
| `region` | Sub-national region/province (may duplicate `administrative_area`; keep whichever your country file already uses) | Where available |
| `approach_notes` | Approach channel, roadstead, or named offshore anchorage used by vessels waiting to enter | Where available |

### PORT CHARACTERISTICS / SIZE
| Field | Notes |
|---|---|
| `port_authority` | Managing authority/operator |
| `ownership` | public / private / public-private / concession (name concessionaire if known) |
| `year_established` | Year opened/founded |
| `port_area`, `water_area` | If published |
| `number_of_berths`, `number_of_terminals` | Count |
| `berth_length_total`, `max_vessel_length`, `turning_basin` | If published |

### CARGO / COMMERCIAL CAPABILITY
| Field | Notes |
|---|---|
| `cargo_types` | container, dry bulk, liquid bulk, breakbulk, ro-ro, general cargo, passenger, fishing, other (specify) |

### CAPACITY (only where a source explicitly states a figure, with year)
| Field | Notes |
|---|---|
| `annual_throughput_teu`, `annual_throughput_tonnage` | With year |
| `storage_capacity` | Tank/silo/yard capacity, with unit and year |
| `berth_capacity_notes` | Any published vessel-handling capacity notes |

### TERMINALS AND EQUIPMENT
| Field | Notes |
|---|---|
| `terminals` | Named terminals within the port, with operator if known |
| `cranes_equipment` | Ship-to-shore cranes, bulk handling equipment |
| `storage_facilities` | Warehouses, yards, tank farms, silos |

### CONNECTIVITY
| Field | Notes |
|---|---|
| `road_connection`, `rail_connection`, `inland_waterway_connection`, `nearby_airport` | As documented |

### VESSEL / NAVIGATION INFORMATION
| Field | Notes |
|---|---|
| `max_draft_m`, `channel_depth_m`, `berth_depth_m` | As published |
| `tidal_restrictions`, `pilotage`, `tug_availability`, `access_restrictions` | If documented |

### OPERATING INFORMATION
| Field | Notes |
|---|---|
| `hours_of_operation`, `seasonal_limitations`, `major_restrictions`, `website` | As documented |

### PROVENANCE (per-field, not just per-record)
| Field | Notes |
|---|---|
| `source` | Source ID(s) from the country's source registry |
| `source_date`, `accessed_date`, `last_verified` | Dates |
| `confidence` | CONFIRMED / STRONG / SUPPORTED / UNVERIFIED / CONFLICTING / UNKNOWN |
| `notes` | Anything a future researcher needs |

### Minimum viable record

For a **major/secondary commercial port**, aim for full coverage of the sections above as evidence allows.

For a **small/long-tail facility** (small fishing harbour, minor river landing, single-jetty terminal), the record is complete enough for inclusion once it has: `port_name`, `country`, `nearby_city`/`settlement`, `port_type`, `operating_status`, `primary_activity` (or `UNKNOWN`), and at least one source. Everything else may legitimately read `UNKNOWN`. Do not treat this as unfinished. It is the expected shape of a long-tail record, and it is not to be padded with guesses to look more complete.

---

## 7. Source Hierarchy

Follow the general evidence hierarchy (master methodology §2). For ports specifically:

- **Tier 1**: National/regional/local port or harbour authority sites, fisheries ministries/authorities, government transport ministries, official gazettes, port master plans, concession documents, environmental/social impact assessments for port projects, UNECE UN/LOCODE database.
- **Tier 2**: Maritime databases/directories (World Port Source, Ports.com, SeaRates, MarineTraffic port pages, MagicPort, etc.: used for cross-checking, not sole evidence for major claims), maritime trade press, regional economic community / development bank port studies (AfDB, World Bank PPI, IFC), NGO/humanitarian logistics capacity assessments (e.g. Logistics Cluster country port profiles: these are unusually good for long-tail/minor-port discovery), fisheries industry/NGO sources, classification/handbook publications.
- **Tier 3**: National/regional/local newspapers, established business/trade publications.
- **Tier 4 (discovery only)**: Wikipedia, generic port directories, aggregator sites, listicles, satellite/mapping references (useful for confirming a facility's physical existence and rough location even when no textual source describes it well).

Discovery sources build the discovery register; they're never the sole basis for a field value in a final record unless no stronger source exists. In which case the field is capped at UNVERIFIED rather than upgraded. For long-tail entries, Tier 2 NGO/logistics assessments and Tier 4 satellite/mapping cross-checks are often the *only* available evidence. That is acceptable and expected; record the confidence honestly (typically SUPPORTED/UNVERIFIED) rather than declining to include the entity.

---

## 8. Confidence Rules & Research Depth by Tier

- `country` and `port_type` must reach at least SUPPORTED before an entity moves to `RESEARCHED`/`VERIFIED` (as opposed to staying `UNRESOLVED` in the discovery register).
- Coordinates should be recorded even at SUPPORTED/UNVERIFIED confidence when a plausible source gives them; if genuinely unpublished, `UNKNOWN` plus a named settlement is an acceptable substitute: it does not block inclusion.
- Any numeric figure (throughput, draft, capacity, area, berth counts) must carry the year/date it refers to; undated figures cap at UNVERIFIED.
- Repetition across sources that appear to copy one original figure does not raise confidence (master §5).
- `operating_status: ACTIVE` requires evidence consistent with §1.1, not merely the absence of a closure notice.

**Research depth is tiered by port significance, not by ease of research:**

- **Major/secondary commercial ports**: research thoroughly across all schema sections (§6); budget up to 8 searches / 4 deep fetches.
- **Regional/minor commercial, industrial, and larger fishing/river/lake ports**: budget ~4–6 searches / 2 deep fetches; populate what's found, `UNKNOWN` the rest.
- **Small/long-tail facilities** (minor fishing landings, small jetties, minor river/lake ports): budget ~2–3 searches; the minimum-viable record (§6) is an acceptable, expected outcome. Do not keep searching past diminishing returns just to fill more fields.

In all tiers: if an entity cannot even clear the minimum-viable bar (name + location + at least directional evidence of category) within budget, it stays `UNRESOLVED` in the discovery register rather than becoming a fabricated-looking record or being quietly dropped.

---

## 9. Discovery Strategy (broadened: this is the primary fix in v3)

Discovery and verification are separate activities (master §6): discovery may be messy, verification must not be. **Discovery must be deliberately broad, not just "major ports in [country]."**

For each country, run discovery across multiple angles, not just one:

**By authority/institution:**
- National port authority / harbour authority (full list, not just its "flagship" ports)
- Maritime or transport ministry
- Fisheries ministry/authority (for fishing harbours: usually a completely different institution than the port authority)
- Railway authority (often names the ports its lines serve)
- Customs/trade authority (border-post lists often include small river/lake ports)

**By reference source:**
- UN/LOCODE listings for the country
- Maritime databases/directories (Tier 2/4)
- NGO/humanitarian logistics capacity assessments (e.g. Logistics Cluster). Frequently the best single source for a country's secondary/minor ports
- Port master plans, concession documents, environmental/social impact assessments for named projects
- Development bank / regional economic community port studies
- Satellite/mapping references, when a facility is visible but undocumented in text

**By activity-specific search** (do these explicitly, per country: this is what catches the long tail):
- "[country] fishing ports" / "[country] fishing harbours"
- "[country] river ports"
- "[country] lake ports" (where the country borders a major lake)
- "[country] oil terminal" / "[country] gas terminal" / "LNG terminal [country]"
- "[country] mining export port" / "[commodity] export terminal [country]"
- "[country] ferry ports" / "[country] passenger ports"
- "[country] bulk terminal"
- "[country] coastal shipping" / "[country] coastal harbours"

Record every entity this turns up, including ones that look marginal, in that country's discovery register (§10). Nothing is discarded silently; every entity is either researched into the dataset, kept `UNRESOLVED` (existence/basic facts still uncertain), or, rarely, logged in `exclusions/` because it turned out not to be a port/facility at all (§3). "Marginal," "small," or "poorly documented" are not grounds to leave something out.

Verification (establishing that a discovered entity is real and current) still follows master §6: prefer official/authority sources, cross-check Tier 2/3, and use Tier 4 only as a last resort or for physical/location confirmation.

During the initial continent-wide discovery pass (§14), prioritize breadth: find the entity, record enough to identify and classify it (name, location, `port_type`, `primary_activity`, `operating_status` at minimum), and move on. Deeper enrichment across the rest of the schema (§6) can follow in a later pass. A thin-but-correct record for every real entity beats an exhaustive record for only a few.

---

## 10. Country Port Discovery Register: status vocabulary (v4: no candidates, no importance-based exclusion)

Each country's `discovered/<country>.md` is a **register** of every real entity known in that country, at whatever stage of research it has reached. There is no "candidate" stage that something can fail out of for being unimportant. An entity's only possible fates are: not yet looked at, being looked into, confirmed and in the dataset, existence still uncertain, or (rarely) confirmed to not actually be a port/facility at all.

| Status | Meaning |
|---|---|
| `DISCOVERED` | Found via a discovery source; not yet researched at all |
| `RESEARCHED` | Investigated enough to record identifying/classifying fields (§9's breadth-pass minimum), but not yet cross-checked to full confidence |
| `VERIFIED` | Confirmed real with credible evidence and has a record under `ports/<country>/`, populated to whatever depth is currently practical (a one-line minimum-viable record is a legitimately `VERIFIED` entry, not a lesser status: see §6/§8) |
| `UNRESOLVED` | Existence itself, or basic classification, could not be established within budget; kept for future re-attempt (master §20), not dropped |
| `OUT_OF_SCOPE` | Researched and determined to genuinely not be a port/harbour/facility per §3 (e.g. a pure anchorage, a recreational-only marina, a naval-only base). Cross-referenced in `exclusions/exclusions.md` with the specific reason |

`RESEARCHED` and `VERIFIED` are both "in the dataset". `RESEARCHED` just means the record is thinner / not yet double-checked, not that the entity is provisional or at risk of removal. Being small, fishing-only, or poorly documented never produces `OUT_OF_SCOPE`: only genuinely not being a qualifying facility does (§3).

The register represents the country's **entire known port universe**, including everything still at `DISCOVERED` or `UNRESOLVED`: it is a living to-do list, not just a record of finished work. A country's discovery phase is done when its register has been populated via the broadened strategy in §9 and every entry has moved beyond bare `DISCOVERED`, or the available research time is exhausted (§14). Not when only its major ports have `VERIFIED` records.

---

## 11. File Format / Output

- `research/ShipPortX/discovered/<country>.md`: the country's Port Discovery Register (§10): entity, discovery source, status, notes.
- `research/ShipPortX/ports/<country>/<port-slug>.md`: one file per `VERIFIED` (or sufficiently-`RESEARCHED`) entity, containing the schema (§6) as tables, field-level confidence/source/notes. Depth scales with tier (§8). A minimum-viable long-tail record is a valid file, not an unfinished one.
- `research/ShipPortX/sources/<country>.md`: source registry; short IDs (e.g. `GH-01`) referenced from port files and the discovery register.
- `research/ShipPortX/unresolved/unresolved.md`: global log of `UNRESOLVED` register entries and open field-level questions, cross-referenced by country.
- `research/ShipPortX/exclusions/exclusions.md`, global log of `OUT_OF_SCOPE` entities with reason (kept short, see §3).
- `research/ShipPortX/logs/research-log.md`: batch-by-batch log per master §19.

A consolidated CSV/JSON export may be generated once a meaningful batch exists; it is a derived artifact, not the source of truth (master §16).

---

## 12. Validation Requirements

In addition to master §17:

- No duplicate `unlocode` values across records.
- No duplicate port entities for the same real-world facility (check aliases first).
- Coordinates, where present, must plausibly fall within the claimed country.
- Every `VERIFIED`/`RESEARCHED` record has `port_type` and `operating_status` from the controlled vocabularies.
- Every field value beyond simple identity traces to a source ID in that country's registry.
- Any record marked `ACTIVE` has at least one piece of evidence consistent with §1.1; otherwise use a different status.
- A country's discovery register must show evidence that the broadened discovery strategy (§9) was actually applied (i.e., it is not just a copy of one "major ports" search) before that country's discovery phase is considered complete.
- `exclusions/exclusions.md` stays reserved for genuinely `OUT_OF_SCOPE` entities (§3). An entry there because something was "too small" or "too poorly documented" is a methodology violation and should be corrected by moving it back into the register as `RESEARCHED`/`VERIFIED`/`UNRESOLVED`.

---

## 13. Per-Entity Stopping Point

Stop researching a single entity when it has cleared the breadth-pass minimum for its tier (§8). Do not chase one obscure specification for one entity while other entities in the same country, or other countries, remain undiscovered. Depth can always be added in a later enrichment pass; a missing entity cannot be recovered just by having spent more time on a different one.

---

## 14. Continent-Wide Discovery Order

Continent-wide discovery (§0, §9) runs as one continuous pass rather than a series of batches requiring sign-off:

1. Work from a recorded progress position, so research can resume exactly where it stopped.
2. Complete the discovery pass for the current country (register populated via §9's broadened strategy; every entity moved beyond bare `DISCOVERED`).
3. Move straight on to the next country in the planned order; finishing one country is not a reason to pause the pass.
4. Save port, discovery and source files and update the progress record regularly as work proceeds, not only at the end.
5. Stop only when the full scope is complete or the available research time runs out.
6. When stopping early, record the exact country position, what is done and what is next, so the following pass can resume without repeating work.

Breadth still outranks depth (§0, §9): a full continent-wide discovery pass at breadth-minimum depth is more valuable than exhaustive depth on a handful of countries.
