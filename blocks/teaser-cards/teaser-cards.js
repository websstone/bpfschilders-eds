/**
 * teaser-cards block — BPF Schilders 3-column promo card grid
 * Fields (model order):
 *   0: cardTitle (newline-delimited)
 *   1: cardDescription (newline-delimited)
 *   2: cardImageSrc (newline-delimited)
 *   3: cardCtaLabel (newline-delimited)
 *   4: cardCtaHref (newline-delimited)
 */

function rowCell(row) { return row ? (row.children[0] || row) : null; }
function cellText(cell) { return cell ? (cell.textContent || '').trim() : ''; }
function splitLines(cell) {
  const text = cellText(cell);
  return text ? text.split('\n').map((s) => s.trim()).filter(Boolean) : [];
}

export default function decorate(block) {
  const rows = [...block.children];
  const propRows = rows.filter((r) => !r.dataset.aueComponent);

  const titles = splitLines(rowCell(propRows[0]));
  const descriptions = splitLines(rowCell(propRows[1]));
  const imageSrcs = splitLines(rowCell(propRows[2]));
  const ctaLabels = splitLines(rowCell(propRows[3]));
  const ctaHrefs = splitLines(rowCell(propRows[4]));

  const cards = titles.map((title, i) => {
    const card = document.createElement('div');
    card.classList.add('card');

    // Image
    const imageContainer = document.createElement('div');
    imageContainer.classList.add('card-image');

    if (imageSrcs[i]) {
      const img = document.createElement('img');
      img.src = imageSrcs[i];
      img.alt = title || '';
      img.loading = 'lazy';
      imageContainer.append(img);
    } else {
      // Placeholder when image not available
      imageContainer.style.backgroundColor = 'rgb(244, 244, 244)';
    }

    // Content area
    const content = document.createElement('div');
    content.classList.add('card-content');

    const titleEl = document.createElement('h2');
    titleEl.classList.add('card-title');
    titleEl.textContent = title;
    content.append(titleEl);

    if (descriptions[i]) {
      const descEl = document.createElement('p');
      descEl.classList.add('card-description');
      descEl.textContent = descriptions[i];
      content.append(descEl);
    }

    if (ctaLabels[i]) {
      const ctaEl = document.createElement('a');
      ctaEl.classList.add('card-cta');
      ctaEl.href = ctaHrefs[i] || '#';
      ctaEl.textContent = ctaLabels[i];
      content.append(ctaEl);
    }

    card.append(imageContainer, content);
    return card;
  });

  block.replaceChildren(...cards);
  block.dataset.blockStatus = 'initialized';
}
