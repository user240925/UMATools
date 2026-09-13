# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UMA Tools is a web scraping and analysis tool for Uma Musume race course and skill data. The tool extracts skill and race course information from Japanese game websites, stores it locally in JSON format, and provides an interactive web interface for analysis.

**Core Purpose**: Extract race course and skill data from dynamic Japanese websites, process multi-language content (Japanese/English), calculate skill efficiency metrics, and enable skill selection/comparison across different race courses.

## Development Commands

```bash
npm install    # Install dependencies (first time; downloads Chromium for Puppeteer)
npm start      # Start the server (node server.js)
```

On Windows, `start.bat` (double-click) is the intended launcher: it verifies Node is installed, runs `npm install` if `node_modules` is missing, opens `http://localhost:10010` in the browser, then runs `node server.js`.

Server runs on `http://localhost:10010` (hardcoded PORT in server.js).

There are no test, lint, or build scripts configured. The frontend is vanilla HTML/JS served statically.

## Architecture Overview

### Three-Tier Application Structure

1. **Backend Server** (server.js) - Express.js API with web scraping
2. **Frontend Interface** (public/index.html) - Single-page vanilla JavaScript application
3. **Data Storage** (data/) - JSON files organized by type (courses, skills, images)

### Key Architectural Patterns

**Data Flow for Race Course Collection**:
1. User provides race course URL → `POST /api/fetch` (Axios static scraping)
2. Parse HTML with Cheerio → Extract skill data from embedded `<script>` tags
3. Merge script data with HTML-parsed data → Download skill icons
4. Auto-save to `data/courses/{venue}/{distance}({surface})/{venue}_{distance}_{runningStyle}.json`

**Data Flow for Skill Collection**:
1. User provides a GameTora skill list URL → `POST /api/fetch-basic`
2. Open GameTora's data manifest and resolve the current versioned `skills.{hash}.json`
3. Read Traditional Chinese (`name_tw`) and Japanese (`jpname`) names directly from the data file
4. Auto-save to `data/skills/{timestamp}_{language}.json`

**Data Flow for Analysis Tab**:
1. Load available courses via `GET /api/courses` (scans data/courses directory)
2. User selects course + running style → Fetch via `GET /api/course-skills`
3. Load skill database via `GET /api/skills-database` for translations
4. Calculate efficiency with skill level system (Lv0-Lv5 with 10-40% discounts)
5. Recursive prerequisite chain cost calculation for advanced skills

## Backend (server.js)

### API Endpoints

**POST /api/fetch** - Race course data collection (Axios)
- Extracts courseId and effectType from URL
- Dual-source parsing: `<script>` tag JSON extraction + HTML parsing
- Script parsing provides: id, rarity, groupId, iconId, needSkillPoint, skill relationships
- HTML parsing provides: effect values, memo text, visual styling
- Auto-downloads skill icons to `data/images/umamusume/skill_icons/`
- Returns merged data with rarity relationships and prerequisite chains

**POST /api/fetch-basic** - Skill list collection
- GameTora URLs use its public, versioned JSON data file discovered through `/data/manifests/umamusume.json`
- Filters to skills with both `name_tw` and `jpname`, preserving the existing `jpName`/`enName` output schema
- Avoids the UI's default 50-row limit, delayed settings menu, and generated CSS class names
- Non-GameTora URLs retain the older Puppeteer DOM extraction as a fallback
- Auto-saves to timestamped JSON file

**GET /api/courses** - Course directory scanner
- Recursively scans `data/courses/{venue}/{distance}({surface})/`
- Groups courses by venue, distance, surface
- Returns available running styles per course

**GET /api/course-skills** - Fetch specific course data
- Parameters: courseName, distance, surface, runningStyle
- Returns full skill data including effect values and relationships

**GET /api/skills-database** - Load latest skill translations
- Returns most recent timestamped file from `data/skills/`
- Used by frontend for jpName lookups

### Parsing Functions

**parseRaceCourseData(html)** - Two-phase parsing strategy
1. **Script extraction**: Regex-based extraction from embedded JavaScript
   - Pattern: `\"id\":(\d+),\"rarity\":(\d+),\"groupId\":(\d+)...`
   - Extracts 400+ skills per page with full metadata
   - Builds groupId index for skill relationship mapping
2. **HTML parsing**: Cheerio-based DOM extraction
   - Targets CSS module classes: `[class*="skillCard"]`, `[class*="courseSkillEffectTable"]`
   - Extracts effect strings (e.g., "0.37[バ]", "0.19[バ/Pt]")
   - Handles nested skills (skills with prerequisite chains)
3. **Data merging**: Combines both sources for complete skill objects

**parseSkillData(html)** - Dual-language skill extraction
- Legacy fallback for non-GameTora pages
- Targets: `[class*="skills_table_row"]` divs
- Extracts icon, jpName, enName from table structure
- Debug mode captures row HTML when parsing fails

**parseUrlParameters(url)** - URL path parser for courseId/effectType

**parseEffectData(effectString, needSkillPoint)** - Effect value parser
- Extracts: effectValue ([バ]), effectPerPoint ([バ/Pt]), effectRange (min~max)
- Calculates efficiency: `effectValue / needSkillPoint * 100`

**parseHeadline(headlineText)** - Course metadata parser
- Format: `{venue} {distance}({surface}){runningStyle}の...`
- Extracts structured data for file naming

### File Organization System

**Course Data**: `data/courses/{venue}/{distance}({surface})/{venue}_{distance}_{runningStyle}.json`
- Example: `data/courses/中京/1800m(ダート)/中京_1800m_先行.json`
- Contains: headline info, skill list with effects, rarity relationships

**Skill Database**: `data/skills/{timestamp}_{language}.json`
- Example: `data/skills/20251216170800_tw.json`
- Contains: icon, jpName, enName for all skills

**Skill Icons**: `data/images/umamusume/skill_icons/{iconId}.webp`
- Auto-downloaded during race course collection
- Skips existing files to avoid re-downloads
- 500ms delay between downloads to respect server

## Frontend (public/index.html)

### Three Main Tabs

1. **Race Course Information Collection (賽道資訊收集)**
   - URL input for race course pages
   - Sub-tabs: Parsed Results (headline, skill JSON) / Raw Content (HTML)
   - Auto-saves to organized directory structure

2. **Skill Information Collection (技能資訊收集)**
   - URL input for skill list pages (default: gametora.com)
   - Automated Taiwan server selection for English names
   - JSON download button for extracted data

3. **Race Course Analysis (賽道資訊分析)**
   - Course selection → Running style buttons → Skill comparison
   - Two-panel layout: Available Skills (C) ↔ Selected Skills (D)
   - Skill level adjustment (Lv0-Lv5) with real-time efficiency calculation
   - Search filter with keyword highlighting (searches both jpName and enName)
   - Related skills display (shows skill rarity variants)

### Skill Efficiency System

**Skill Level Discounts**: [0%, 10%, 20%, 30%, 35%, 40%] for Lv0-Lv5
- Discount applies to needSkillPoint cost
- Efficiency formula varies by skill type

**Standard Skills** (no prerequisites):
```
actualCost = originalCost × (1 - discount)
efficiency = baseEfficiency ÷ (1 - discount)
```

**Advanced Skills** (with prerequisite chains):
```
cumulativeCost = prerequisiteChainCost + actualCost
efficiency = (effectValue × 100) ÷ cumulativeCost
```

**Prerequisite Chain Resolution**:
- Recursively identifies lower-rarity or lower-groupRate skills as prerequisites
- Example chain: `左回り○` → `左回り◎` → `左回りの鬼`
- Adjusting any skill in chain updates final skill efficiency
- Chain detection uses rarityValue and groupRate comparisons

### CSS Module Handling

Frontend uses `[class*="partial_match"]` selectors because:
- Build tools generate dynamic class names (e.g., `skills_table_row__abc123`)
- Partial matching ensures selectors work across builds
- Critical classes: `skills_table_enname`, `skills_table_jpname`, `skillCard--`, `courseSkillEffectTable`

## Data Schema

### Course JSON Structure
```json
{
  "headline": "中京 1800m（ダート）先行の有効加速/スキル効果值/Pt効率",
  "headlineInfo": {
    "courseName": "中京",
    "distance": "1800m",
    "surface": "ダート",
    "runningStyle": "先行"
  },
  "skillList": [
    {
      "id": 200041,
      "name": "Left Turn",
      "rarity": "gold",
      "rarityValue": 2,
      "groupId": 20004,
      "needSkillPoint": 170,
      "iconId": 200041,
      "icon": "/images/umamusume/skill_icons/200041.webp",
      "iconUrl": "https://...",
      "effectData": {
        "effectValue": 0.37,
        "effectPerPoint": 0.19,
        "calculatedEfficiency": 21.76
      },
      "relatedSkills": [
        {"id": 200042, "name": "Left Turn◎", "rarity": "ssr", "rarityValue": 5}
      ]
    }
  ]
}
```

### Skill Database JSON Structure
```json
{
  "skills": [
    {
      "icon": "https://...",
      "jpName": "左回り○",
      "enName": "Left Turn"
    }
  ]
}
```

## Critical Implementation Details

### GameTora Skill Collection Sequence
1. Launch with `--no-sandbox --disable-setuid-sandbox` (containerized environments)
2. Navigate directly to `/data/manifests/umamusume.json` with a 20-second timeout
3. Resolve the current `skills` hash and fetch `/data/umamusume/skills.{hash}.json`
4. Keep entries with non-empty `name_tw` and `jpname`, and map them to the existing schema
5. Close Chromium with a 5-second upper bound; kill its process if graceful close stalls

The browser is retained to use the same TLS/browser environment as GameTora. It no longer waits for page hydration, advertising requests, settings controls, or skill-table rendering. The frontend also aborts requests after 45 seconds so its loading state cannot remain indefinitely.

Note: skill collection (`/api/fetch-basic`) no longer downloads icon images — icons are downloaded only by the race-course collection flow (`saveCourseData`).

### HTML Parsing Resilience
- Cheerio selectors use partial class matching: `[class*="skills_table_row"]`
- Fallback hierarchy: direct children → find() deep search → debug capture
- Debug info includes: row HTML, found elements, class names, search attempts
- Handles nested skill structures (skills with multiple rarity variants in same container)

### Skill Relationship Mapping
- Script data provides `groupId` for all related skills
- Group members sorted by `rarityValue` (descending) for display
- Prerequisite detection logic:
  1. Find lower `rarityValue` with highest `groupRate` (direct prerequisite)
  2. If not found, find same `rarityValue` with lower `groupRate`
  3. Recursively resolve chains until no prerequisites remain

### File Naming Conventions
- Timestamps: `YYYYMMDDHHMMSS` format (e.g., `20251216170800`)
- Course directories: Japanese characters supported (e.g., `中京`)
- Skill icons: `{iconId}.webp` format

## Common Issues

**Missing Japanese Names (`enName` fields empty in the legacy schema)**:
1. Verify the current GameTora skills JSON still contains `jpname`
2. Verify the manifest still exposes a `skills` hash
3. Check whether GameTora renamed `name_tw` or `jpname`

**Puppeteer Launch Failures**:
- Add `--no-sandbox --disable-setuid-sandbox` args
- Ensure Chrome/Chromium installed
- Check headless mode compatibility on Windows

**Script Parsing Failures**:
- Regex pattern expects specific JSON structure in `<script>` tags
- Look for script with `length > 100000` (large data blob)
- Pattern must match: `\"skillName\":\"`, `\"groupId\":`, etc.

**Effect Calculation Discrepancies**:
- Skills with `effectRangeMin/Max` show "範圍" badge
- Range-based skills use single value (may differ from reference sites)
- Prerequisite chain costs accumulate (verify all chain members considered)

**File Save Failures**:
- Ensure `data/courses/`, `data/skills/`, `data/images/` directories exist
- Server auto-creates directories but may fail with permission issues
- Check Windows path length limits for deep nested directories
