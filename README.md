# Podcast JSON to RSS Converter (Deno v2)

## Overview
This Deno application converts podcast JSON (fetched from a URL) to a proper RSS feed format, including iTunes and Media RSS extensions.

## Requirements
- [Deno](https://deno.land/) (v1.x or v2.x)

## Running the Application
1.  Navigate to the project directory:
    ```bash
    cd podcast-rss-converter
    ```
2.  Run the server using Deno:
    ```bash
    deno run --allow-net --allow-env mod.ts 
    ```
    - `--allow-net`: Required to fetch the JSON URL and serve HTTP requests.
    - `--allow-env`: Potentially needed if using environment variables (e.g., for PORT, although currently hardcoded to 3000).

The server will start on `http://localhost:3000`.

## Usage

### Endpoint: `/convert`
**Method:** GET

**Query Parameter:**
- `url` (required): The URL-encoded path to the podcast JSON file.

### Input JSON Schema
(The application expects the JSON at the provided URL to conform to this structure)
```typescript
export interface Root {
  episode_frequency: string;
  estimated_next_episode_at: string;
  has_seasons: boolean;
  season_count: number;
  episode_count: number;
  has_more_episodes: boolean;
  podcast: Podcast;
}

export interface Podcast {
  url: string;
  title: string;
  author: string;
  description: string;
  description_html: string;
  category: string;
  audio: boolean;
  show_type: string;
  uuid: string;
  fundings: any[];
  guid: string;
  is_private: boolean;
  transcript_eligible: boolean;
  episodes: Episode[];
  image_url?: string;
}

export interface Episode {
  uuid: string;
  title: string;
  url: string;
  file_type: string;
  file_size: number;
  duration: number;
  published: string;
  type: string;
  image_url?: string;
}
```

### Example Request (using curl)
Replace `https://example.com/podcast.json` with the actual URL to your JSON data.

```bash
curl "http://localhost:3000/convert?url=https%3A%2F%2Fexample.com%2Fpodcast.json"
```

*Note: Ensure the `url` parameter value is URL-encoded.* You can also access this directly in your browser.

### Output
- The response body will be the generated RSS feed in XML format.
- The `X-Podcast-Metadata` response header will contain additional metadata extracted from the root of the JSON object.

## Error Handling
- Returns 404 for unknown paths.
- Returns 400 if the `url` query parameter is missing.
- Returns 500 if fetching the JSON or converting to RSS fails, with an error message in the response body.

## Dependencies
- Deno Standard Library (`@std/http`)
- `@dbushell/rss` (from `deno.land/x`)
