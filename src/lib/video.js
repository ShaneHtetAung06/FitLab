

const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
];

const VIMEO_HOSTS = ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'];

const VIDEO_FILE_PATTERN = /\.(mp4|webm|ogg|ogv|m4v|mov)$/i;

function extractYouTubeId(parsed) {

  if (parsed.hostname.replace(/^www\./, '') === 'youtu.be') {
    return parsed.pathname.slice(1).split('/')[0] || null;
  }

  const queryId = parsed.searchParams.get('v');
  if (queryId) return queryId;

  
  const match = parsed.pathname.match(
    /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{6,})/
  );
  return match ? match[1] : null;
}


function extractVimeoId(parsed) {
  const match = parsed.pathname.match(/\/(?:video\/)?(\d{6,})/);
  if (!match) return null;

  
  const after = parsed.pathname.split(match[1])[1] || '';
  const hash = after.match(/^\/([A-Za-z0-9]+)/);

  return { id: match[1], hash: hash ? hash[1] : null };
}

export function parseVideoUrl(url) {
  const empty = {
    provider: null,
    id: null,
    embedUrl: null,
    thumbnailUrl: null,
    url: '',
  };

  if (typeof url !== 'string' || !url.trim()) return empty;

  const trimmed = url.trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (error) {
    return empty;
  }

  // Only ever embed over https/http, never javascript: or data: URLs.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return empty;

  const host = parsed.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.includes(host)) {
    const id = extractYouTubeId(parsed);
    if (!id) return { ...empty, provider: 'link', url: trimmed };

    // nocookie keeps YouTube from setting tracking cookies until playback.
    return {
      provider: 'youtube',
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: trimmed,
    };
  }

  if (VIMEO_HOSTS.includes(host)) {
    const result = extractVimeoId(parsed);
    if (!result) return { ...empty, provider: 'link', url: trimmed };

    return {
      provider: 'vimeo',
      id: result.id,
      embedUrl: `https://player.vimeo.com/video/${result.id}${
        result.hash ? `?h=${result.hash}` : ''
      }`,
      thumbnailUrl: null,
      url: trimmed,
    };
  }

  if (VIDEO_FILE_PATTERN.test(parsed.pathname)) {
    return {
      provider: 'file',
      id: null,
      embedUrl: trimmed,
      thumbnailUrl: null,
      url: trimmed,
    };
  }

  return { ...empty, provider: 'link', url: trimmed };
}

/**
 * True when a string is a usable http(s) video link. Empty is allowed because a
 * lesson may be text only.
 */
export function isValidVideoUrl(url) {
  if (url === '' || url === null || url === undefined) return true;
  return parseVideoUrl(url).provider !== null;
}

/** Friendly provider name for display. */
export function videoProviderLabel(url) {
  const { provider } = parseVideoUrl(url);
  switch (provider) {
    case 'youtube':
      return 'YouTube';
    case 'vimeo':
      return 'Vimeo';
    case 'file':
      return 'Video file';
    case 'link':
      return 'External link';
    default:
      return '';
  }
}
