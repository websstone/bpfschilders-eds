/**
 * Tiles block — card grid for InfoTilesWithCtas / PolicyCoverageLoginTeaser.
 *
 * Two variants detected via CSS class on the block element:
 *   default   — white-card promotional tiles with images + CTA buttons
 *   inverted  — full-purple hero/stat banner (single tile, no images)
 *
 * Child-cascade pattern (mirrors blocks/carousel/carousel.js):
 *   When UE has authored individual tile-item children, each child row has
 *   data-aue-model="tile-item" or data-aue-component set.  decorate() prefers
 *   those rows and reads per-item fields from data-aue-prop attributes.
 *   When no child rows are present it falls back to the original flat-property
 *   parser (multi-line values in a single parent row).
 *
 * tile-item fields (component-models.json):
 *   tile_link, tile_image, tile_heading, tile_body, tile_cta_text, tile_icon
 *
 * @param {Element} block
 */
async function fetchCtaData(block) {
  const urn = block.dataset.aueResource || '';
  if (!urn) return [];
  const jcrPath = urn.replace('urn:aemconnection:', '');
  if (!jcrPath) return [];
  try {
    const resp = await fetch(`${jcrPath}.json`, {
      headers: { Authorization: `Basic ${btoa('admin:admin')}` },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const raw = data.tile_cta || '';
    return raw.split('\n').map((line) => {
      const [text, url] = line.split('|').map((s) => s.trim());
      return text && url ? { text, url } : null;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Extract plain text from a <p> element, but only when the paragraph does NOT
 * contain media (img / picture).  Media paragraphs are returned as-is via
 * extractMedia() and must never be .textContent-stripped here.
 */
function propText(el) {
  if (!el) return '';
  return (el.textContent || '').trim();
}

/**
 * Extract an image source from a field paragraph.  Handles three shapes:
 *   1. <p data-aue-prop="tile_image"><picture><img src="…"></picture></p>
 *   2. <p data-aue-prop="tile_image"><a href="…">…</a></p>   (reference field)
 *   3. plain text src
 */
function extractImageSrc(el) {
  if (!el) return '';
  const img = el.querySelector('img');
  if (img) return img.src || img.getAttribute('src') || '';
  const anchor = el.querySelector('a');
  if (anchor) return decodeURIComponent(anchor.getAttribute('href') || '').trim();
  return propText(el);
}

/**
 * Return the <picture> element from a field paragraph when one exists,
 * otherwise null.  Callers that want the full media element use this so they
 * can append the picture directly rather than reconstructing it.
 */
function extractPicture(el) {
  if (!el) return null;
  return el.querySelector('picture') || null;
}

/**
 * Parse a single child row (data-aue-model="tile-item") into a plain object.
 *
 * Two modes:
 *  1. UE edit mode — paragraphs carry data-aue-prop; use them directly.
 *  2. Dev-server / publish mode — data-aue-prop is absent; classify paragraphs
 *     positionally using their content:
 *       - A paragraph whose sole non-whitespace child is an <a> (no inner text
 *         other than the anchor, or an anchor-only paragraph) → tile_link.
 *       - A paragraph that contains a <picture> or <img> → tile_image.
 *       - Every remaining plain-text paragraph is assigned to the next slot in
 *         schema order: tile_heading → tile_body → tile_cta_text → tile_icon.
 *
 * Schema field order: tile_link, tile_image, tile_heading, tile_body,
 *   tile_cta_text, tile_icon (empty fields are omitted from the rendered HTML).
 */
function parseTileItemRow(row) {
  const paragraphs = [...row.querySelectorAll('p')];

  // Prefer data-aue-prop when present (UE edit mode).
  const hasProps = paragraphs.some((p) => p.dataset.aueProp);
  if (hasProps) {
    const byProp = (prop) => paragraphs.find((p) => p.dataset.aueProp === prop) || null;
    return {
      link: propText(byProp('tile_link')),
      imageSrc: extractImageSrc(byProp('tile_image')),
      picture: extractPicture(byProp('tile_image')),
      heading: propText(byProp('tile_heading')),
      body: propText(byProp('tile_body')),
      ctaText: propText(byProp('tile_cta_text')),
      icon: propText(byProp('tile_icon')),
    };
  }

  // Classifier-positional reading for dev-server / publish mode.
  let linkEl = null;
  let imageEl = null;
  const textSlots = []; // heading, body, cta_text, icon in order

  paragraphs.forEach((p) => {
    if (!linkEl) {
      // A link-only paragraph: contains an <a> and no other visible text outside it.
      const anchor = p.querySelector('a');
      if (anchor && p.textContent.trim() === anchor.textContent.trim()) {
        linkEl = p;
        return;
      }
    }
    if (!imageEl && p.querySelector('picture, img')) {
      imageEl = p;
      return;
    }
    // Everything else is a text slot.
    textSlots.push(p);
  });

  const [headingP, bodyP, ctaTextP, iconP] = textSlots;

  // For the link field, prefer the href of the anchor inside linkEl so that
  // buildDefaultCard receives a usable URL string.
  const linkHref = linkEl ? (linkEl.querySelector('a')?.getAttribute('href') || propText(linkEl)) : '';

  return {
    link: linkHref,
    imageSrc: extractImageSrc(imageEl),
    picture: extractPicture(imageEl),
    heading: propText(headingP),
    body: propText(bodyP),
    ctaText: propText(ctaTextP),
    icon: propText(iconP),
  };
}

/**
 * Build a default (white-card) tile element from a normalised tile data object.
 * ctaFromFetch is the legacy fetched CTA object (may be undefined).
 */
function buildDefaultCard(tileData, ctaFromFetch) {
  const { imageSrc, picture, heading, body, ctaText, link } = tileData;

  const card = document.createElement('div');
  card.className = 'panel';

  if (picture) {
    // Preserve the full <picture> element authored in UE (media guard).
    const figure = document.createElement('figure');
    figure.className = 'box-image';
    figure.append(picture.cloneNode(true));
    card.append(figure);
  } else if (imageSrc) {
    const figure = document.createElement('figure');
    figure.className = 'box-image';
    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = heading;
    img.loading = 'lazy';
    img.decoding = 'async';
    figure.append(img);
    card.append(figure);
  }

  if (heading) {
    const h2 = document.createElement('h2');
    h2.textContent = heading;
    card.append(h2);
  }

  if (body) {
    const p = document.createElement('p');
    p.className = 'tile-body';
    p.textContent = body;
    card.append(p);
  }

  // CTA: prefer explicitly authored ctaText + link, then legacy fetched CTA.
  const finalCtaText = ctaText || (ctaFromFetch && ctaFromFetch.text) || '';
  const finalCtaUrl = link || (ctaFromFetch && ctaFromFetch.url) || '';
  if (finalCtaText && finalCtaUrl) {
    const a = document.createElement('a');
    a.href = finalCtaUrl;
    a.className = 'button';
    a.textContent = finalCtaText;
    card.append(a);
  }

  return card;
}

/**
 * Build an inverted (purple stat/link) tile element from a normalised tile
 * data object.
 */
function buildInvertedPanel(tileData) {
  const { heading, body, link: ctaUrl } = tileData;

  const tile = document.createElement('div');
  tile.className = 'top-panel';

  const isLink = heading && heading.toUpperCase() === heading && heading.length < 20;
  if (isLink && ctaUrl) {
    const a = document.createElement('a');
    a.href = ctaUrl;
    a.className = 'top-panel-link';
    const label = document.createElement('span');
    label.textContent = heading;
    a.append(label);
    tile.append(a);
  } else if (heading) {
    const label = document.createElement('span');
    label.textContent = heading;
    tile.append(label);
  }

  if (body) {
    const val = document.createElement('span');
    val.className = 'stat-value';
    val.textContent = body;
    tile.append(val);
  }

  return tile;
}

export default async function decorate(block) {
  const isInverted = block.classList.contains('inverted');

  // ── 1. Partition rows into child-item rows vs. parent rows ─────────────────
  // Mirrors the cascade pattern in blocks/carousel/carousel.js.
  const allRows = [...block.children];
  const childRows = [];
  const parentRows = [];
  allRows.forEach((row) => {
    if (row.dataset.aueModel === 'tile-item' || row.dataset.aueComponent) {
      childRows.push(row);
    } else {
      parentRows.push(row);
    }
  });

  // ── 2. Resolve tile data objects ───────────────────────────────────────────
  let tiles = [];

  if (childRows.length > 0) {
    // Container format: each child row is an individually-authored tile-item.
    tiles = childRows
      .map((row) => parseTileItemRow(row))
      .filter((t) => t.heading);
  } else {
    // ── Flat-property fallback (original logic) ──────────────────────────────
    const row = parentRows[0];
    if (!row) return;

    const cell = row.children[0] || row;
    const paragraphs = [...cell.querySelectorAll('p')];
    if (!paragraphs.length) return;

    const findByProp = (prop) => paragraphs.find((p) => p.dataset.aueProp === prop);
    const headingP = findByProp('tile_heading') || paragraphs[0];
    const bodyP = findByProp('tile_body') || paragraphs[1];
    const imageP = findByProp('tile_image') || paragraphs[2];
    const ctaTextP = findByProp('tile_cta_text') || paragraphs[3];
    const ctaUrlP = findByProp('tile_cta_url') || paragraphs[4];

    const splitLines = (el) => {
      if (!el) return [];
      return (el.textContent || '').split('\n').map((s) => s.trim()).filter(Boolean);
    };

    const extractImages = (el) => {
      if (!el) return [];
      const anchor = el.querySelector('a');
      if (anchor) {
        const raw = decodeURIComponent(anchor.getAttribute('href') || '');
        return raw.split('\n').map((s) => s.trim()).filter(Boolean);
      }
      return splitLines(el);
    };

    const headings = splitLines(headingP);
    const bodies = splitLines(bodyP);
    const images = extractImages(imageP);
    const ctaTexts = splitLines(ctaTextP);
    const ctaUrls = splitLines(ctaUrlP);

    if (!headings.length) return;

    tiles = headings.map((heading, i) => ({
      link: ctaUrls[i] || '',
      imageSrc: images[i] || '',
      picture: null,
      heading,
      body: bodies[i] || '',
      ctaText: ctaTexts[i] || '',
      icon: '',
    }));
  }

  if (!tiles.length) return;

  // ── 3. Build DOM ───────────────────────────────────────────────────────────
  const ctas = isInverted ? [] : await fetchCtaData(block);

  const grid = document.createElement('div');
  grid.className = 'tiles-grid';

  tiles.forEach((tileData, i) => {
    const el = isInverted
      ? buildInvertedPanel(tileData)
      : buildDefaultCard(tileData, ctas[i]);
    grid.append(el);
  });

  block.replaceChildren(grid);
}
