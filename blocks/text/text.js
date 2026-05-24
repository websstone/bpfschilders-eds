/**
 * Text block — static rich-text editorial content.
 *
 * Source components: ArticleRichText, AnnualPensionChangeArticle,
 * DisabilityDataUpdateInfo, InformationalArticle, LoginPageHeading.
 *
 * Model (single field):
 *   rows[0] → body (richtext)
 *
 * Variants (signalled by extra CSS class on the block element):
 *   default  — max-width 760px column, no extra top padding
 *   intro    — adds padding-top 40px; body should begin with an h1
 *
 * @param {HTMLElement} block
 */
export default function decorate(block) {
  // --- 1. Extract body cell -------------------------------------------------
  // AEM Franklin renders one row per model field.  This block has one field,
  // so block.children[0] is the row and its first child is the cell.
  const bodyRow = block.children[0];
  const bodyCell = bodyRow ? bodyRow.children[0] : null;

  if (!bodyCell) return;

  // --- 2. Clean up authored content -----------------------------------------

  // EC-text-003: remove leading paragraphs that contain only whitespace / &nbsp;
  const children = [...bodyCell.children];
  for (const el of children) {
    if (el.tagName === 'P' && !el.textContent.trim().replace(/ /g, '')) {
      el.remove();
    } else {
      break; // stop at the first non-empty element
    }
  }

  // EC-text-002: strip empty anchor elements (href present, no visible text).
  bodyCell.querySelectorAll('a').forEach((a) => {
    if (!a.textContent.trim() && !a.children.length) {
      a.remove();
    }
  });

  // --- 3. Promote body cell content into the block root ---------------------
  // Replace the AEM-generated row/cell wrapper with the raw body content so
  // CSS selectors target the native heading/paragraph tags directly.
  block.innerHTML = '';
  block.append(...bodyCell.childNodes);
}
