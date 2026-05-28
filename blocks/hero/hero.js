/**
 * Hero block — page-level heading section.
 *
 * Source components: LoginPageHeading (P1 inventory), contact-page hero
 * (Wave A DOM scrape, /contact/).
 *
 * Content model (two fields, both optional):
 *   rows[0] -> heading  (text or richtext)   — rendered as <h1>
 *   rows[1] -> subhead  (richtext, optional)  — rendered as <p class="hero-subhead">
 *
 * If only one row is present it is treated as the heading row.
 * If the heading row contains a pre-existing <h1> element (authored richtext),
 * that element is promoted directly rather than wrapping in a new <h1>.
 *
 * Variants (extra CSS class on the block element):
 *   default  — compact, heading-only style (contact page, login page)
 *   with-image — adds a background image sourced from an optional third row
 *
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  // --- 1. Extract rows -------------------------------------------------------
  const rows = [...block.children];

  let headingRow;
  let subheadRow;
  let imageRow;

  if (rows.length >= 3) {
    [headingRow, subheadRow, imageRow] = rows;
  } else if (rows.length === 2) {
    [headingRow, subheadRow] = rows;
  } else if (rows.length === 1) {
    [headingRow] = rows;
  }

  const headingCell = headingRow ? headingRow.children[0] : null;
  const subheadCell = subheadRow ? subheadRow.children[0] : null;
  const imageCell = imageRow ? imageRow.children[0] : null;

  // Nothing authored — hide silently so the block doesn't leave a visual gap.
  if (!headingCell && !subheadCell) return;

  // --- 2. Build output DOM ---------------------------------------------------
  const fragment = document.createDocumentFragment();

  // --- 2a. Heading -----------------------------------------------------------
  if (headingCell) {
    const text = (headingCell.textContent || '').trim();
    if (text) {
      // If the authored cell already contains an <h1> promote it as-is.
      const existingH1 = headingCell.querySelector('h1');
      if (existingH1) {
        fragment.appendChild(existingH1);
      } else {
        const h1 = document.createElement('h1');
        h1.textContent = text;
        fragment.appendChild(h1);
      }
    }
  }

  // --- 2b. Subhead -----------------------------------------------------------
  if (subheadCell) {
    const subText = (subheadCell.textContent || '').trim();
    if (subText) {
      // Preserve richtext markup by moving child nodes; fall back to text node.
      const hasMarkup = subheadCell.children.length > 0;
      if (hasMarkup) {
        const wrapper = document.createElement('div');
        wrapper.className = 'hero-subhead';
        wrapper.append(...subheadCell.childNodes);
        fragment.appendChild(wrapper);
      } else {
        const p = document.createElement('p');
        p.className = 'hero-subhead';
        p.textContent = subText;
        fragment.appendChild(p);
      }
    }
  }

  // --- 2c. Optional background image ----------------------------------------
  if (imageCell) {
    const img = imageCell.querySelector('img, picture');
    if (img) {
      // Apply as CSS background via inline style on the block element
      // so it doesn't interfere with the text DOM flow.
      const src = img.tagName === 'IMG'
        ? img.src
        : (img.querySelector('source[srcset]')?.srcset?.split(' ')[0] || img.querySelector('img')?.src);
      if (src) {
        block.style.setProperty('--hero-bg-image', `url('${src}')`);
        block.classList.add('has-image');
      }
    }
  }

  // --- 3. Swap block content -------------------------------------------------
  block.innerHTML = '';
  block.appendChild(fragment);
}
