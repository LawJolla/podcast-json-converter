import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// Use the original 'rss' package via npm specifier
import RSS from "npm:rss@^1.2.2";

// Define the input JSON schema types (optional but good practice)
interface Episode {
  uuid: string;
  title: string;
  url: string;
  file_type: string;
  file_size: number;
  duration: number;
  published: string;
  type: string;
  image_url?: string; // Make image_url optional
}

interface Podcast {
  url: string;
  title: string;
  author: string;
  description: string;
  description_html: string;
  category: string;
  audio: boolean;
  show_type: string;
  uuid: string;
  fundings: unknown[];
  guid: string;
  is_private: boolean;
  transcript_eligible: boolean;
  episodes: Episode[];
  image_url?: string; // Make image_url optional
}

interface Root {
  episode_frequency: string;
  estimated_next_episode_at: string;
  has_seasons: boolean;
  season_count: number;
  episode_count: number;
  has_more_episodes: boolean;
  podcast: Podcast;
}

interface LatestEpisode {
  uuid: string
  title: string
  url: string
  published: string
  show_notes: string
  hash: string
  modified: number
  image: string
  transcripts: unknown[]
}

interface LatestPodcastData {
  episodes: LatestEpisode[];
}

export interface LatestPodcastsRoot {
  podcast: LatestPodcastData;
}

export interface LatestPodcast {
  uuid: string
  episodes: LatestEpisode[]
}

// Function to convert JSON podcast data to RSS, optionally merging latest episode data
function convertToRSS(podcastData: Root, latestEpisodesMap?: Map<string, LatestEpisode>): string {
  if (!podcastData || !podcastData.podcast) {
    throw new Error('Invalid podcast JSON structure');
  }

  const { podcast } = podcastData;

  // Create a new RSS feed using the npm:rss package API
  const feed = new RSS({
    title: podcast.title,
    description: podcast.description,
    feed_url: podcast.url, // Assuming podcast.url is the intended feed URL
    site_url: podcast.url, // Assuming podcast.url is also the site URL
    image_url: podcast.image_url || '',
    author: podcast.author,
    language: 'en-us',
    pubDate: new Date().toUTCString(), // Or use a date from podcastData if available
    ttl: 60,
    generator: 'Deno Podcast Converter (via npm:rss)',
    custom_namespaces: {
      'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
      'content': 'http://purl.org/rss/1.0/modules/content/',
      'media': 'http://search.yahoo.com/mrss/'
    },
    custom_elements: [
      {'itunes:author': podcast.author},
      {'itunes:summary': podcast.description},
      {'itunes:type': podcast.show_type},
      {'itunes:explicit': 'false'}, // Assuming false
      {'content:encoded': podcast.description_html},
      {'itunes:category': { _attr: { text: podcast.category } }},
      {'itunes:image': { _attr: { href: podcast.image_url || '' } }},
      // Standard image element (often redundant with itunes:image but good practice)
      {'image': [
        { url: podcast.image_url || '' },
        { title: podcast.title },
        { link: podcast.url } // Link associated with the image (usually site_url)
      ]}
    ]
  });

  podcast.episodes.slice(podcast.episodes.length - 10, podcast.episodes.length - 8).forEach(episode => {
    const pubDate = new Date(episode.published);
    feed.item({
      title: episode.title,
      description: '', // Add episode description if available in schema
      url: episode.url, // Link to the episode page
      guid: episode.uuid,
      date: pubDate,
      enclosure: {
        url: episode.url, // **CRITICAL**: This should be the AUDIO/VIDEO file URL, not the episode page URL. Update schema if needed.
        size: episode.file_size,
        type: episode.file_type
      },
      author: podcast.author, // Episode author, defaults to podcast author
      custom_elements: [
        {'itunes:duration': Math.floor(episode.duration)},
        {'itunes:episodeType': episode.type},
        // Use image from latestEpisodesMap if available, otherwise fallback (which might be empty)
        {'itunes:image': { _attr: { href: latestEpisodesMap?.get(episode.uuid)?.image || podcast.image_url || '' } }},
        // Add media:content for episode image if desired (check compatibility)
        {'media:content': [
           {
             _attr: {
               url: latestEpisodesMap?.get(episode.uuid)?.image || podcast.image_url || '',
               medium: 'image',
               // Ensure you have a way to determine the image type, defaulting to jpeg
               type: 'image/jpeg'
             }
           }
         ]}
      ]
    });
  });

  // Generate RSS XML using the npm:rss package method
  return feed.xml({ indent: true });
}

// Main request handler
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname !== '/convert') {
    return new Response("Not Found", { status: 404 });
  }

  const urlParam = url.searchParams.get('url');
  const latestPodcastsUrlParam = url.searchParams.get('latestPodcastsUrl'); // New optional parameter

  if (!urlParam) {
    return new Response('Missing required `url` query parameter', { status: 400 });
  }

  try {
    // Decode the URL
    const podcastJsonUrl = decodeURIComponent(urlParam);
    let latestPodcastJsonUrl: string | null = null;
    if (latestPodcastsUrlParam) {
      latestPodcastJsonUrl = decodeURIComponent(latestPodcastsUrlParam);
    }

    // Fetch the primary podcast JSON data
    const response = await fetch(podcastJsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch podcast JSON: ${response.statusText} from ${podcastJsonUrl}`);
    }
    const podcastData: Root = await response.json();

    // Fetch the optional latest podcasts JSON data if URL provided
    let latestEpisodesMap: Map<string, LatestEpisode> | undefined = undefined;
    if (latestPodcastJsonUrl) {
      try {
        const latestResponse = await fetch(latestPodcastJsonUrl);
        if (!latestResponse.ok) {
          console.warn(`Failed to fetch latest podcasts JSON: ${latestResponse.statusText} from ${latestPodcastJsonUrl}. Proceeding without it.`);
        } else {
          // Assuming the structure contains { podcast: { episodes: [...] } } or similar
          // Adjust parsing based on the actual structure of the latestPodcastsUrl endpoint
          const latestData: LatestPodcastsRoot = await latestResponse.json(); 
          if (latestData?.podcast?.episodes) {
            latestEpisodesMap = new Map(latestData.podcast.episodes.map(ep => [ep.uuid, ep]));
            console.log(`Successfully fetched and mapped ${latestEpisodesMap.size} episodes from latest podcasts URL.`);
          } else {
             console.warn(`Latest podcasts JSON from ${latestPodcastJsonUrl} did not contain expected 'podcast.episodes' structure. Proceeding without it.`);
          }
        }
      } catch (latestError) {
         console.warn(`Error processing latest podcasts JSON from ${latestPodcastJsonUrl}: ${latestError instanceof Error ? latestError.message : String(latestError)}. Proceeding without it.`);
      }
    }

    // Convert to RSS, passing the optional map
    const rssFeed = convertToRSS(podcastData, latestEpisodesMap);

    // Return the RSS feed
    return new Response(rssFeed, {
      headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
    });
  } catch (error) {
    console.error('Conversion error:', error);
    if (error instanceof Error) {
      return new Response(`Failed to convert podcast JSON: ${error.message}`, { status: 500 });
    }
    return new Response(`Failed to convert podcast JSON: ${String(error)}`, { status: 500 });
  }
}

console.log("Podcast RSS Converter (Deno) running on http://localhost:3000");
serve(handler, { port: 3000 });
