import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Resolve the AEM author origin from the hlx:proxyUrl meta tag.
 * On the local dev server (localhost:3000), the meta points to localhost:4503 which
 * is proxied transparently, so we can use window.location.origin for fetch.
 * @returns {string} origin (e.g. '' for same-origin)
 */
function aemOrigin() {
  // The dev server at localhost:3000 proxies /content/** to AEM author.
  // Use same-origin (empty string) so fetch hits localhost:3000 which proxies.
  return '';
}

/**
 * Extract the JCR path from a data-aue-resource URN.
 * "urn:aemconnection:/content/foo/bar" -> "/content/foo/bar"
 * @param {Element} el
 * @returns {string|null}
 */
function jcrPath(el) {
  const resource = el && el.dataset && el.dataset.aueResource;
  if (!resource) return null;
  const prefix = 'urn:aemconnection:';
  return resource.startsWith(prefix) ? resource.slice(prefix.length) : null;
}

/**
 * Fetch JCR node properties as JSON.
 * @param {string} path JCR path (e.g. "/content/bpfschilders-eds/…/node")
 * @returns {Promise<Object|null>}
 */
async function fetchJcr(path) {
  if (!path) return null;
  try {
    const resp = await fetch(`${aemOrigin()}${path}.json`);
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

/**
 * Decorates the text block (SupplementaryLinksBlock).
 *
 * The block stores title, description, and ctas as direct JCR properties on the
 * block node itself (not as child items). aem.live's renderer does not expose
 * scalar JCR properties as table cells, so the block element is empty in HTML.
 * This decorator fetches the JCR node's .json to read those properties.
 *
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const path = jcrPath(block);
  const data = await fetchJcr(path);

  // Build the replacement container.
  const container = document.createElement('div');
  container.className = 'text-inner';

  if (data) {
    // --- Title ---
    const titleText = (data.title || '').trim();
    if (titleText) {
      const h2 = document.createElement('h2');
      h2.textContent = titleText;
      container.appendChild(h2);
    }

    // --- Description (richtext or plain text) ---
    const descRaw = (data.description || '').trim();
    if (descRaw) {
      const descWrapper = document.createElement('div');
      descWrapper.className = 'text-description';
      // If the value contains HTML tags, treat as richtext and set via innerHTML.
      // Plain-text values are also safe through innerHTML (no tags to interpret).
      if (/<[a-z][\s\S]*>/i.test(descRaw)) {
        descWrapper.innerHTML = descRaw;
      } else {
        // Plain text — preserve paragraph breaks split on double newlines.
        const paragraphs = descRaw.split(/\n\n+/).filter(Boolean);
        if (paragraphs.length > 1) {
          paragraphs.forEach((para) => {
            const p = document.createElement('p');
            p.textContent = para.trim();
            descWrapper.appendChild(p);
          });
        } else {
          // Single-paragraph — render each newline as a <br>.
          const p = document.createElement('p');
          const lines = descRaw.split('\n');
          lines.forEach((line, idx) => {
            p.appendChild(document.createTextNode(line));
            if (idx < lines.length - 1) p.appendChild(document.createElement('br'));
          });
          descWrapper.appendChild(p);
        }
      }
      container.appendChild(descWrapper);
    }

    // --- CTAs (stored as richtext HTML or plain text / newline-separated links) ---
    const ctasRaw = (data.ctas || '').trim();
    if (ctasRaw) {
      const ctasWrapper = document.createElement('div');
      ctasWrapper.className = 'text-ctas';
      // If the value contains HTML tags, set as richtext so links render as <a>.
      if (/<[a-z][\s\S]*>/i.test(ctasRaw)) {
        ctasWrapper.innerHTML = ctasRaw;
      } else {
        // Plain text — each non-empty line becomes a list item.
        // Lines that consist only of a URL or path (no human-readable label)
        // are suppressed: raw URL/path strings must never appear as visible body
        // text.  Lines that carry actual label text are rendered verbatim.
        const looksLikeUrl = (s) => /^(\/|https?:\/\/)/.test(s);
        const ul = document.createElement('ul');
        ctasRaw.split('\n').map((s) => s.trim()).filter(Boolean).forEach((line) => {
          // Skip bare URL/path-only lines — they have no human-readable label
          // so rendering them would just show the raw path as text.
          if (looksLikeUrl(line)) return;
          const li = document.createElement('li');
          li.textContent = line;
          ul.appendChild(li);
        });
        if (ul.children.length > 0) {
          ctasWrapper.appendChild(ul);
        }
      }
      container.appendChild(ctasWrapper);
    }
  }

  // Transfer UE instrumentation from the block element to the container.
  moveInstrumentation(block, container);
  block.replaceChildren(container);
}
