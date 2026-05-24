/**
 * Tiles block — card grid for InfoTilesWithCtas / PolicyCoverageLoginTeaser.
 *
 * AEM EDS with UE renders all model fields as <p> siblings inside one cell:
 *   <p data-aue-prop="tile_heading">heading1\nheading2\n...</p>
 *   <p data-aue-prop="tile_body">body1\nbody2\n...</p>
 *   <p> (tile_image as <a href="...">)</p>
 *
 * @param {Element} block
 */
export default function decorate(block) {
  const row = block.children[0];
  if (!row) return;

  const cell = row.children[0] || row;
  const paragraphs = [...cell.querySelectorAll('p')];
  if (!paragraphs.length) return;

  // Find fields by data-aue-prop or fall back to position
  const findByProp = (prop) => paragraphs.find((p) => p.dataset.aueProp === prop);
  const headingP = findByProp('tile_heading') || paragraphs[0];
  const bodyP = findByProp('tile_body') || paragraphs[1];
  const imageP = findByProp('tile_image') || paragraphs[2];

  const splitLines = (el) => {
    if (!el) return [];
    return (el.textContent || '').split('\n').map((s) => s.trim()).filter(Boolean);
  };

  // Image field: AEM renders @reference as <a href="...">; extract href and decode %0A
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

  if (!headings.length) return;

  const grid = document.createElement('div');
  grid.className = 'tiles-grid';

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

    grid.append(card);
  });

  block.replaceChildren(grid);
}
