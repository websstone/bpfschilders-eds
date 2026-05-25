/**
 * Tiles block — card grid for InfoTilesWithCtas / PolicyCoverageLoginTeaser.
 *
 * Two variants detected via CSS class on the block element:
 *   default   — white-card promotional tiles with images + CTA buttons
 *   inverted  — full-purple hero/stat banner (single tile, no images)
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

export default async function decorate(block) {
  const isInverted = block.classList.contains('inverted');
  const row = block.children[0];
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

  const grid = document.createElement('div');
  grid.className = 'tiles-grid';

  const ctas = isInverted ? [] : await fetchCtaData(block);

  if (isInverted) {
    headings.forEach((heading, i) => {
      const tile = document.createElement('div');
      tile.className = 'top-panel';

      const ctaUrl = ctaUrls[i] || '';
      const isLink = heading.toUpperCase() === heading && heading.length < 20;
      if (isLink && ctaUrl) {
        const a = document.createElement('a');
        a.href = ctaUrl;
        a.className = 'top-panel-link';
        const label = document.createElement('span');
        label.textContent = heading;
        a.append(label);
        tile.append(a);
      } else {
        const label = document.createElement('span');
        label.textContent = heading;
        tile.append(label);
      }

      const body = bodies[i] || '';
      if (body) {
        const val = document.createElement('span');
        val.className = 'stat-value';
        val.textContent = body;
        tile.append(val);
      }

      grid.append(tile);
    });
  } else {
    headings.forEach((heading, i) => {
      const card = document.createElement('div');
      card.className = 'panel';

      const imgSrc = images[i] || '';
      if (imgSrc) {
        const figure = document.createElement('figure');
        figure.className = 'box-image';
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = heading;
        img.loading = 'lazy';
        img.decoding = 'async';
        figure.append(img);
        card.append(figure);
      }

      const h2 = document.createElement('h2');
      h2.textContent = heading;
      card.append(h2);

      const body = bodies[i] || '';
      if (body) {
        const p = document.createElement('p');
        p.className = 'tile-body';
        p.textContent = body;
        card.append(p);
      }

      const ctaTextInline = ctaTexts[i] || '';
      const ctaUrlInline = ctaUrls[i] || '';
      const ctaFromFetch = ctas[i];
      const finalCtaText = ctaTextInline || (ctaFromFetch && ctaFromFetch.text) || '';
      const finalCtaUrl = ctaUrlInline || (ctaFromFetch && ctaFromFetch.url) || '';
      if (finalCtaText && finalCtaUrl) {
        const a = document.createElement('a');
        a.href = finalCtaUrl;
        a.className = 'button';
        a.textContent = finalCtaText;
        card.append(a);
      }

      grid.append(card);
    });
  }

  block.replaceChildren(grid);
}
