/**
 * article-card block — EDS / Universal Editor
 *
 * Visual sources: ArticleTeaser (default), NewsletterMagazineTeaser,
 *                 ChildrenPensionArticle, RelatedLinksTeaser (horizontal).
 *
 * Variants (set via block class modifier in the header cell):
 *   default            — flex-column, image above text
 *   horizontal         — flex-row, image left ~40%, text right
 *   horizontal bordered — flex-row + 1px solid rgb(220,220,220) border
 *
 * AEM UE vertical model (6 rows × 1 cell each, field order):
 *   row 0  image      <picture> / <img> or empty
 *   row 1  image_alt  plain text (alt string)
 *   row 2  title      required heading text (promoted to <h2>)
 *   row 3  summary    richtext paragraphs / lists / inline links
 *   row 4  cta        href string
 *   row 5  cta_label  visible button text
 *
 * EDS document table (2-column, rows collapsed):
 *   row 0  image cell | image_alt cell
 *   row 1  title cell
 *   row 2  summary cell
 *   row 3  cta cell   | cta_label cell
 *
 * The decorator auto-detects which layout it receives by inspecting row/cell counts.
 *
 * DOM output:
 *   <div class="article-card block [horizontal] [bordered]">
 *     <div class="card-image">        <!-- only when image present -->
 *       <img src="…" alt="…">
 *     </div>
 *     <div class="card-body">
 *       <h2 class="card-heading">…title…</h2>
 *       <div class="card-summary">…richtext…</div>  <!-- only when summary present -->
 *       <a class="button" href="…">…label…</a>      <!-- only when cta + label present -->
 *     </div>
 *   </div>
 */

/**
 * Return trimmed text content of an element, or '' if falsy.
 * @param {Element|null} el
 * @returns {string}
 */
function cellText(el) {
  return el ? (el.textContent || '').trim() : '';
}

/**
 * Detect whether the authored rows use the "6-row UE model" or the
 * "4-row EDS table" layout and return a normalised field bag.
 *
 * UE model (6 rows, 1 cell each):
 *   [0] image  [1] image_alt  [2] title  [3] summary  [4] cta  [5] cta_label
 *
 * EDS table (up to 4 rows, 2 cells in image/cta rows):
 *   [0] image | image_alt   [1] title   [2] summary   [3] cta | cta_label
 *   (image row and cta row may be absent; title is always present)
 *
 * @param {HTMLCollection} rows
 * @returns {{ imageEl: Element|null, imageAlt: string, title: string,
 *             summaryEl: Element|null, ctaHref: string, ctaLabel: string }}
 */
function parseRows(rows) {
  const arr = [...rows];
  let imageEl = null;
  let imageAlt = '';
  let title = '';
  let summaryEl = null;
  let ctaHref = '';
  let ctaLabel = '';

  // Detect UE 6-row model: all rows have exactly 1 child cell
  const allSingleCell = arr.every((r) => r.children.length === 1);

  if (allSingleCell && arr.length >= 2) {
    // UE vertical model
    // Row 0: image — contains <picture>/<img> or is empty
    // Row 1: image_alt
    // Row 2: title (required)
    // Row 3: summary
    // Row 4: cta href
    // Row 5: cta_label
    const getCell = (n) => (arr[n] ? arr[n].children[0] : null);

    const row0 = getCell(0);
    const maybeImg = row0 ? row0.querySelector('img, picture') : null;
    if (maybeImg) {
      imageEl = maybeImg.closest('picture') || maybeImg;
      const altCell = getCell(1);
      imageAlt = cellText(altCell);
      title = cellText(getCell(2));
      summaryEl = getCell(3);
      ctaHref = cellText(getCell(4));
      ctaLabel = cellText(getCell(5));
    } else {
      // No image row — title is row 0 (or row 2 if alt took slot 1)
      title = cellText(row0);
      summaryEl = getCell(1);
      ctaHref = cellText(getCell(2));
      ctaLabel = cellText(getCell(3));
    }
  } else {
    // EDS 2-column table layout
    // Find image row (first row whose first cell contains <img>/<picture>)
    let cursor = 0;
    const first = arr[cursor];
    const firstCell = first ? first.children[0] : null;
    const hasImg = firstCell && firstCell.querySelector('img, picture');

    if (hasImg) {
      imageEl = firstCell.querySelector('picture') || firstCell.querySelector('img');
      imageAlt = cellText(first.children[1]);
      cursor += 1;
    }

    // Title row
    const titleRow = arr[cursor];
    title = cellText(titleRow ? titleRow.children[0] : null);
    cursor += 1;

    // Summary row (optional — present when remaining rows > 1,
    // or when the next row has no 2nd cell with text)
    const nextRow = arr[cursor];
    if (nextRow) {
      const nextFirstCell = nextRow.children[0];
      const nextSecondCell = nextRow.children[1];
      // CTA row has a meaningful second cell (label text); summary row does not
      const isCtaRow = nextSecondCell && cellText(nextSecondCell).length > 0;
      if (!isCtaRow) {
        summaryEl = nextFirstCell || null;
        cursor += 1;
      }
    }

    // CTA row
    const ctaRow = arr[cursor];
    if (ctaRow) {
      const ctaCell = ctaRow.children[0];
      // cta cell may contain a raw href string or an <a> element
      const ctaAnchor = ctaCell ? ctaCell.querySelector('a') : null;
      ctaHref = ctaAnchor
        ? (ctaAnchor.getAttribute('href') || cellText(ctaAnchor))
        : cellText(ctaCell);
      ctaLabel = cellText(ctaRow.children[1]);
    }
  }

  return {
    imageEl,
    imageAlt,
    title,
    summaryEl,
    ctaHref,
    ctaLabel,
  };
}

/**
 * Build the card-image container from the source image element.
 * Transfers the alt attribute from parsed imageAlt when the img element
 * has a missing or empty alt.
 *
 * @param {Element} imageEl
 * @param {string} imageAlt
 * @returns {HTMLDivElement}
 */
function buildCardImage(imageEl, imageAlt) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card-image';

  // Clone to avoid removing from its original location before we replace children
  const cloned = imageEl.cloneNode(true);

  // Ensure alt attribute is present on <img> (even if empty)
  const img = cloned.tagName === 'IMG' ? cloned : cloned.querySelector('img');
  if (img && !img.hasAttribute('alt')) {
    img.setAttribute('alt', imageAlt || '');
  } else if (img && img.getAttribute('alt') === '' && imageAlt) {
    img.setAttribute('alt', imageAlt);
  }

  wrapper.appendChild(cloned);
  return wrapper;
}

/**
 * Loads and decorates the article-card block.
 * @param {Element} block
 */
export default function decorate(block) {
  const {
    imageEl, imageAlt, title, summaryEl, ctaHref, ctaLabel,
  } = parseRows(block.children);

  // ── card-image ──────────────────────────────────────────────────────────────
  const cardImage = imageEl ? buildCardImage(imageEl, imageAlt) : null;

  // ── card-body ───────────────────────────────────────────────────────────────
  const cardBody = document.createElement('div');
  cardBody.className = 'card-body';

  // Heading
  if (title) {
    const h2 = document.createElement('h2');
    h2.className = 'card-heading';
    h2.textContent = title;
    cardBody.appendChild(h2);
  }

  // Summary — preserve full richtext innerHTML (inline links, lists, paragraphs)
  if (summaryEl && summaryEl.innerHTML.trim()) {
    const summary = document.createElement('div');
    summary.className = 'card-summary';
    summary.innerHTML = summaryEl.innerHTML;
    // Suppress empty <p> elements (trailing whitespace / &nbsp; paragraphs from CMS)
    summary.querySelectorAll('p').forEach((p) => {
      if (!p.textContent.trim() && !p.querySelector('img, a')) {
        p.remove();
      }
    });
    cardBody.appendChild(summary);
  }

  // CTA — only render when both href and label are present (EC-article-card-001)
  if (ctaHref && ctaLabel) {
    const cta = document.createElement('a');
    cta.className = 'button';
    cta.href = ctaHref;
    cta.textContent = ctaLabel;
    cardBody.appendChild(cta);
  }

  // ── Assemble — transfer UE instrumentation from original rows ────────────────
  // Preserve data-aue-* attributes from block element itself (already on block)
  const children = [];
  if (cardImage) children.push(cardImage);
  children.push(cardBody);

  block.replaceChildren(...children);
}
