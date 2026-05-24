/**
 * Text block — static rich-text editorial content.
 *
 * Source components: ArticleRichText, AnnualPensionChangeArticle,
 * DisabilityDataUpdateInfo, InformationalArticle, LoginPageHeading.
 *
 * Model (single field):
 *   rows[0] -> body (richtext)
 *
 * Variants (signalled by extra CSS class on the block element):
 *   default  -- max-width 760px column, no extra top padding
 *   intro    -- adds padding-top 40px; body should begin with an h1
 *
 * @param {HTMLElement} block
 */

/** P4-repair df-004: ETL placeholder pattern emitted by P3 when content mapping is incomplete. */
const PLACEHOLDER_RE = /^\[CONTENT:\s*[^\]]+\]$/;

/**
 * Returns true if the text content of el looks like an unresolved ETL placeholder.
 * @param {Element} el
 */
function isPlaceholder(el) {
  return PLACEHOLDER_RE.test((el.textContent || '').trim());
}

export default function decorate(block) {
  // --- 1. Extract body cell -------------------------------------------------
  // AEM Franklin renders one row per model field.  This block has one field,
  // so block.children[0] is the row and its first child is the cell.
  const bodyRow = block.children[0];
  const bodyCell = bodyRow ? bodyRow.children[0] : null;

  if (!bodyCell) return;

  // --- 2. Clean up authored content -----------------------------------------

  // EC-text-003: remove leading paragraphs that contain only whitespace / &nbsp;
  [...bodyCell.children].forEach((el) => {
    if (el.tagName === 'P' && !el.textContent.trim().replace(/ /g, '')) {
      el.remove();
    }
  });

  // EC-text-002: strip empty anchor elements (href present, no visible text).
  bodyCell.querySelectorAll('a').forEach((a) => {
    if (!a.textContent.trim() && !a.children.length) {
      a.remove();
    }
  });

  // P4-repair df-004: suppress unresolved P3 ETL placeholders so they do not
  // render verbatim in production. Hide the entire block if every visible child
  // is a placeholder token.  Log a warning to aid debugging.
  const visibleChildren = [...bodyCell.children].filter((el) => el.textContent.trim());
  const allPlaceholders = visibleChildren.length > 0
    && visibleChildren.every((el) => isPlaceholder(el));
  if (allPlaceholders || isPlaceholder(bodyCell)) {
    // eslint-disable-next-line no-console
    console.warn('[text block] Suppressing unresolved ETL placeholder content:', bodyCell.textContent.trim());
    if (block.closest('.section')) {
      block.closest('.section').classList.add('text-placeholder-suppressed');
    }
    block.hidden = true;
    return;
  }

  // --- 3. Promote body cell content into the block root ---------------------
  // Replace the AEM-generated row/cell wrapper with the raw body content so
  // CSS selectors target the native heading/paragraph tags directly.
  block.innerHTML = '';
  block.append(...bodyCell.childNodes);
}
