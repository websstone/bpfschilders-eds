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
 * Read title/description/ctas from the delivered block cells.
 * franklin.delivery serializes the text block as three rows (model order:
 * title, description, ctas), each a single cell. This is the data source on the
 * published site; the JCR .json fetch only works in the author/UE context.
 * @param {Element} block
 * @returns {{title: string, description: string, ctas: string}}
 */
function readFromCells(block) {
  const cellOf = (row) => (row ? row.querySelector(':scope > div') || row : null);
  const valueOf = (row) => {
    const cell = cellOf(row);
    if (!cell) return '';
    // Preserve markup for richtext fields (description/ctas); plain text otherwise.
    return cell.querySelector('*') ? cell.innerHTML.trim() : (cell.textContent || '').trim();
  };
  const rows = [...block.children];
  return {
    title: (cellOf(rows[0])?.textContent || '').trim(),
    description: valueOf(rows[1]),
    ctas: valueOf(rows[2]),
  };
}

/**
 * Decorates the text block (SupplementaryLinksBlock).
 *
 * Reads title, description, and ctas from the three delivered cells (works on
 * the published site), falling back to the JCR node's .json for the author/UE
 * context, where the cells render empty.
 *
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  let data = readFromCells(block);
  if (!data.title && !data.description && !data.ctas) {
    data = await fetchJcr(jcrPath(block)) || data;
  }

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
