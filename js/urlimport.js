// ===== URL Import: fetch article via Jina Reader, convert to plain text =====

const READER_BASE = 'https://r.jina.ai/';

/** Returns true if the string is a valid http/https URL */
export function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Fetch article content via Jina Reader.
 * Returns the raw response text (structured with Title/URL Source/Markdown Content).
 * Throws on network error, timeout, or non-ok response.
 */
export async function fetchArticle(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(READER_BASE + url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/plain',
        'X-Timeout': '15',
      },
    });
    if (!response.ok) {
      if (response.status === 404) throw new Error('Page not found.');
      if (response.status === 451) throw new Error('This site is temporarily unavailable for import. Try again later.');
      throw new Error('Could not fetch this page. Please try again.');
    }
    const text = await response.text();
    // Jina returns JSON errors even on 200 sometimes
    if (text.startsWith('{"data":null')) {
      throw new Error('Could not fetch this page. Please try again.');
    }
    return text;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out.');
    if (err.message === 'Page not found.' || err.message.startsWith('Could not') || err.message.startsWith('This site'))
      throw err;
    throw new Error('Could not fetch this page. Please try again.');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse the structured Jina Reader response into title and markdown body.
 * Response format:
 *   Title: ...
 *   URL Source: ...
 *   Markdown Content:
 *   ...body...
 */
export function parseJinaResponse(text) {
  let title = '';
  let markdown = '';

  // Jina's metadata prologue is always at the very top: Title, URL Source, then Markdown Content.
  // Only search within the first 1000 chars to avoid false matches in article body.
  const prologue = text.substring(0, 1000);

  const titleMatch = prologue.match(/^Title:\s*(.+)$/m);
  if (titleMatch) title = stripHtmlTags(titleMatch[1].trim());

  const contentMatch = prologue.match(/^Markdown Content:\s*$/m);
  if (contentMatch) {
    markdown = text.substring(contentMatch.index + contentMatch[0].length).trim();
  } else {
    // Fallback: use everything
    markdown = text;
  }

  return { title, markdown };
}

/** Strip all HTML tags from a string (used for titles) */
function stripHtmlTags(str) {
  return str.replace(/<[^>]+>/g, '');
}

/**
 * Find the end of a balanced parenthesized group starting at pos (which points to '(').
 * Returns the index of the closing ')' or -1 if unbalanced.
 * Linear time, no backtracking.
 */
function findClosingParen(str, pos) {
  let depth = 0;
  for (let i = pos; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Strip markdown links and images using linear scanning (avoids regex backtracking).
 * Handles URLs with balanced parentheses like Wikipedia's C_(programming_language).
 */
function stripMarkdownLinksAndImages(text) {
  let result = '';
  let i = 0;

  while (i < text.length) {
    // Linked image: [![alt](img)](url)
    if (text[i] === '[' && text[i + 1] === '!' && text[i + 2] === '[') {
      const altEnd = text.indexOf('](', i + 3);
      if (altEnd !== -1) {
        const imgClose = findClosingParen(text, altEnd + 1);
        if (imgClose !== -1 && text[imgClose + 1] === ']' && text[imgClose + 2] === '(') {
          const linkClose = findClosingParen(text, imgClose + 2);
          if (linkClose !== -1) {
            i = linkClose + 1;
            continue;
          }
        }
      }
    }

    // Image: ![alt](url)
    if (text[i] === '!' && text[i + 1] === '[') {
      const altEnd = text.indexOf('](', i + 2);
      if (altEnd !== -1) {
        const close = findClosingParen(text, altEnd + 1);
        if (close !== -1) {
          i = close + 1;
          continue;
        }
      }
    }

    // Wiki edit links: [[edit](...)]
    if (text.startsWith('[[edit](', i)) {
      const close = findClosingParen(text, i + 7);
      if (close !== -1 && text[close + 1] === ']') {
        i = close + 2;
        continue;
      }
    }

    // Reference markers: [[1]](url)
    if (text[i] === '[' && text[i + 1] === '[') {
      const numEnd = text.indexOf(']]', i + 2);
      if (numEnd !== -1 && /^\d+$/.test(text.substring(i + 2, numEnd))) {
        if (text[numEnd + 2] === '(') {
          const close = findClosingParen(text, numEnd + 2);
          if (close !== -1) {
            i = close + 1;
            continue;
          }
        }
        // [[N]] without URL
        i = numEnd + 2;
        continue;
      }
    }

    // Regular link: [text](url) or [text](url "title")
    if (text[i] === '[') {
      const altEnd = text.indexOf('](', i + 1);
      if (altEnd !== -1 && !text.substring(i + 1, altEnd).includes('\n')) {
        const close = findClosingParen(text, altEnd + 1);
        if (close !== -1) {
          // Keep the link text, discard the URL
          result += text.substring(i + 1, altEnd);
          i = close + 1;
          continue;
        }
      }
    }

    result += text[i];
    i++;
  }

  return result;
}

/**
 * Strip markdown formatting to produce clean plain text for RSVP reading.
 */
export function markdownToPlainText(md) {
  let text = md;

  // Extract and protect code blocks/spans from ALL markdown processing
  const codeSlots = [];
  text = text.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, code) => {
    codeSlots.push(code);
    return `\x00CODE${codeSlots.length - 1}\x00`;
  });
  text = text.replace(/`([^`]*)`/g, (_, code) => {
    codeSlots.push(code);
    return `\x00CODE${codeSlots.length - 1}\x00`;
  });

  // Strip links and images using linear scanner (handles balanced parens safely)
  text = stripMarkdownLinksAndImages(text);

  // Remove reference-style images and links
  text = text.replace(/\[!\[[^\]]*\]\[[^\]]*\]\]\[[^\]]*\]/g, ''); // linked ref images [![alt][img]][link]
  text = text.replace(/!\[[^\]]*\]\[[^\]]*\]/g, ''); // ref images ![alt][ref]
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1'); // ref links [text][ref] → text
  text = text.replace(/^\[[^\]]+\]:\s+.+$/gm, '');

  // Remove heading markers (ATX and setext styles)
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^[=-]{3,}\s*$/gm, '');

  // Remove bold/italic markers (asterisk-based only; underscores in words like foo_bar are kept)
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // Remove blockquote markers
  text = text.replace(/^>\s?/gm, '');

  // Strip markdown table syntax (pipe-delimited rows and separator lines)
  text = text.replace(/^\|[-:| ]+\|$/gm, ''); // separator rows like |---|---|
  text = text.replace(/^\|(.+)\|$/gm, (_, row) => row.replace(/\|/g, ' — ').trim()); // data rows

  // Remove script/style blocks entirely (tag + content)
  text = text.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Replace block-level HTML tags with newlines (so text doesn't get glued together)
  text = text.replace(/<\/?(?:div|p|br|table|tr|td|th|ul|ol|li|h[1-6]|section|article|aside|nav|header|footer|figure|figcaption|blockquote|pre|hr|dl|dt|dd|details|summary|iframe|form)\b[^>]*>/gi, '\n');

  // Remove remaining inline HTML tags (only known tags to avoid stripping e.g. generic <T>)
  text = text.replace(/<\/?(?:span|a|img|em|strong|b|i|u|s|sub|sup|code|abbr|cite|mark|small|time|var|kbd|samp|wbr|data|ruby|rt|rp|bdi|bdo|input|button|select|textarea|label|meta|link)\b[^>]*>/gi, '');

  // Restore protected code content
  text = text.replace(/\x00CODE(\d+)\x00/g, (_, idx) => codeSlots[idx]);

  // Collapse multiple blank lines into one
  text = text.replace(/\n{3,}/g, '\n\n');

  // Trim each line
  text = text.split('\n').map(line => line.trim()).join('\n');

  return text.trim();
}
