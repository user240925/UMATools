# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UMA Tools is a web scraping tool designed to collect race course and skill information from Uma Musume-related websites. The tool consists of an Express.js backend server and a single-page frontend with a tabbed interface.

**Primary Purpose**: Extract and parse race course data and skill information from Japanese game websites, specifically handling dynamic content rendering and multi-language support (Japanese/English names).

## Running the Application

Start the server:
```bash
npm start
```

The server runs on `http://localhost:3000` by default (configurable via PORT variable in server.js).

## Architecture

### Backend (server.js)

**Express Server**: Node.js server with two main API endpoints and three parsing functions.

**API Endpoints**:
- `POST /api/fetch` - Fetches race course data using Axios (static HTML)
  - Parses URL parameters (courseId, effectType)
  - Extracts headline and skill cards from race course pages

- `POST /api/fetch-basic` - Fetches skill data using Puppeteer (dynamic rendering)
  - Launches headless browser in incognito mode
  - Automatically clicks settings gear icon and enables Taiwan server checkbox (#serverTwCheckbox)
  - Waits for dynamic content to load before scraping
  - Critical: Must wait for `skills_table_enname` elements to appear after server selection

**Parsing Functions**:
1. `parseUrlParameters(url)` - Extracts courseId and effectType from URL path
2. `parseRaceCourseData(html)` - Parses race course pages using Cheerio
   - Targets: `headlineDefault_component_headlineDefault__body` for headline
   - Targets: `courseSkillEffectTable_component_courseSkillEffectTable` for skill cards
   - Extracts: name, effect, description, icon, images, input values, data attributes, styling info

3. `parseSkillData(html)` - Parses skill list pages using Cheerio
   - Targets: `[class*="skills_table_row"]` divs
   - Extracts: icon (img src), jpName (skills_table_jpname), enName (skills_table_enname)
   - Includes detailed debug info when elements not found

### Frontend (public/index.html)

**Single-Page Application**: Pure vanilla JavaScript with no frameworks.

**Main Tabs**:
- Race Course Information Collection (賽道資訊收集)
- Skill Information Collection (技能資訊收集)

**Key Features**:
- Tab system with both main tabs and sub-tabs (Parsed Results / Raw Content)
- JSON download functionality for skill data
- Real-time fetch status with loading indicators
- Error handling with user-friendly messages

**Important Selectors**:
- Settings icon: `img[src*="settings.png"]`
- Taiwan server checkbox: `#serverTwCheckbox`
- Skill table wrapper: `.skills_skill_table__ZoEHP`

## Dependencies

- **express**: Web server framework
- **axios**: HTTP client for static page fetching
- **cheerio**: jQuery-like HTML parsing
- **puppeteer**: Headless browser for dynamic content

## Critical Implementation Details

### Puppeteer Flow for Skill Data
1. Launch headless Chrome with no-sandbox flags
2. Create incognito browser context
3. Set viewport to 1920x1080 and standard User-Agent
4. Navigate with `networkidle2` wait condition
5. Wait for settings icon, click it
6. Wait for and click Taiwan server checkbox
7. Wait 5 seconds for content update
8. Wait for `skills_table_enname` elements to be visible
9. Additional 2-second buffer for rendering
10. Extract full HTML content

### HTML Parsing Strategies
- Use `[class*="..."]` selectors for partial class matching (CSS modules generate dynamic class names)
- Fall back to searching entire row if direct children don't contain target elements
- Debug mode captures detailed element info when parsing fails
- Row styling detection checks: class names, style attributes, row index (odd/even), and data attributes

### Server Selection Automation
The skill fetching endpoint automatically:
- Locates the settings gear icon by image source
- Clicks the Taiwan server checkbox to enable English name display
- Waits for dynamic re-rendering with multiple timeout strategies
- Continues execution even if automation fails (graceful degradation)

## Common Issues

**Missing English Names**: If `enName` fields are empty, check:
1. Taiwan server selection succeeded (check server_log.txt)
2. Wait times are sufficient (currently 5s + 2s)
3. `skills_table_enname` selector matches current HTML structure

**Puppeteer Errors**: Run with `--no-sandbox --disable-setuid-sandbox` flags for containerized environments.

**Timeout Failures**: Increase timeout values in:
- `page.goto()` timeout (default: 30000ms)
- `page.waitForSelector()` timeouts (5000-10000ms)
- Post-click delays (currently 1000-5000ms)
