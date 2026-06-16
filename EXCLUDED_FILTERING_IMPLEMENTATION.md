# Excluded Categories and Domains Implementation

## Overview
This implementation adds comprehensive filtering to exclude specific categories and domains from being displayed or inserted into the system.

## Files Modified/Created

### 1. New File: `utils/excludedCategoriesAndDomains.js`
**Purpose**: Configuration and utility functions for exclusion filtering

**Contents**:
- `EXCLUDED_CATEGORIES`: Array of 77 excluded category names
- `EXCLUDED_DOMAINS`: Array of 115 excluded domain names
- `extractDomain(url)`: Extracts domain from a URL
- `isExcludedDomain(domain)`: Checks if a domain is excluded
- `hasExcludedCategory(rawCategories)`: Checks if categories contain any excluded ones
- `shouldExcludePlace(place)`: Main function to determine if a place should be excluded

### 2. Modified: `models/placeModel.js`
**Changes**:
1. Import the exclusion utilities
2. **In `upsertPlace()` function**:
   - Added check to skip places with excluded categories or domains
   - Prevents insertion from scraper

3. **In `listPlaces()` function**:
   - Added WHERE clause conditions to exclude places with:
     - Excluded categories in `main_category` field
     - Excluded domains in `web` field

4. **In `getMeta()` function**:
   - Excludes filtered categories from metadata queries
   - Ensures only valid categories appear in filter dropdowns

**Effect**: 
- Scrapers cannot insert excluded places
- UI lists never show excluded places
- Metadata doesn't include excluded categories

### 3. Modified: `models/leadModel.js`
**Changes**:
1. Import the exclusion utilities
2. **In `listLeads()` function**:
   - Added WHERE clause conditions to exclude leads with excluded domains in their `web` field

3. **In `generateLeadsFromPlaces()` function**:
   - Added exclusion checks before fetching places
   - Prevents lead generation from excluded places

**Effect**:
- Leads with excluded domains are not displayed
- Automatic lead generation skips excluded places

## Filtering Logic

### Categories to Exclude (77 total)
Government offices, security, social services, health institutions, banks, utilities, public services, religious institutions, courts, parking, transportation, etc.

### Domains to Exclude (115 total)
Government sites, fast food chains, retail stores, banks, insurance companies, utilities, telecom companies, and other commercial domains.

## How It Works

### Place Insertion (Scraper)
```
1. Scraper fetches results from Google Maps API
2. bulkUpsertPlaces() processes each result
3. upsertPlace() checks: if shouldExcludePlace(place) → skip
4. Only non-excluded places are inserted
```

### Place Display
```
1. User requests list of places
2. listPlaces() builds SQL WHERE clause with:
   - main_category NOT LIKE '%excluded_category%' (for each excluded)
   - web NOT LIKE '%excluded_domain%' (for each excluded)
3. Only non-excluded places are returned
```

### Lead Display
```
1. User requests list of leads
2. listLeads() adds WHERE clause:
   - web NOT LIKE '%excluded_domain%' (for each excluded)
3. Only non-excluded leads are returned
```

## Backwards Compatibility

If excluded places/leads were inserted before this implementation:
- They will be automatically filtered from all lists
- They won't appear in the UI
- They won't appear in metadata dropdowns
- New leads won't be generated from them

## Performance Notes

- Filtering happens at the SQL level (WHERE clause) for efficiency
- For insertion, filtering is checked in-memory before DB operations
- Metadata queries filter at the database level

## Database Query Impact

The exclusion filters add multiple LIKE conditions to WHERE clauses:
- listPlaces: Adds ~80 + 115 conditions (all AND combined)
- listLeads: Adds ~115 conditions
- getMeta: Similar additions per query

For production optimization, consider:
- Creating indexed columns for category/domain matching
- Caching excluded lists
- Using database views for common filtering patterns

## Testing Checklist

- [x] Excluded places are not inserted by scraper
- [x] Excluded places don't appear in place lists
- [x] Excluded places don't appear in metadata
- [x] Excluded leads don't appear in lead lists
- [x] Leads can't be generated from excluded places
- [x] Manual place-to-lead conversion respects filtering (UI-level)

## Configuration Updates

To add/remove excluded categories or domains:
1. Edit `utils/excludedCategoriesAndDomains.js`
2. Update the `EXCLUDED_CATEGORIES` or `EXCLUDED_DOMAINS` arrays
3. No database migrations needed
4. Changes apply immediately to all queries
