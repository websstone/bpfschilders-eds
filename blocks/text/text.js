/**
 * Text block — static rich-text editorial content.
 *
 * Source components: ArticleRichText, AnnualPensionChangeArticle,
 * DisabilityDataUpdateInfo, InformationalArticle, LoginPageHeading.
 *
 * Model (two fields, title is optional):
 *   rows[0] -> title (text, optional) — renders as h2 heading above body
 *   rows[1] -> body (richtext)
 *
 * If only one row is present it is treated as body (backward-compatible).
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
  // --- 1. Extract rows -------------------------------------------------------
  // AEM Franklin renders one row per model field.
  // Model order: [title (optional), body]
  const rows = [...block.children];
  let titleRow;
  let bodyRow;

  if (rows.length >= 2) {
    // Two-field model: first row = title, second row = body
    [titleRow, bodyRow] = rows;
  } else if (rows.length === 1) {
    // Legacy single-row blocks (body only) — backward compatible
    [bodyRow] = rows;
  }

  const titleCell = titleRow ? titleRow.children[0] : null;
  const bodyCell = bodyRow ? bodyRow.children[0] : null;

  if (!bodyCell && !titleCell) return;

  // --- 2. P4-repair df-004: suppress unresolved P3 ETL placeholders ----------
  if (bodyCell) {
    const visibleChildren = [...bodyCell.children].filter((el) => el.textContent.trim());
    const allPlaceholders = visibleChildren.length > 0
      && visibleChildren.every((el) => isPlaceholder(el));
    const directPlaceholder = isPlaceholder(bodyCell);

    if (allPlaceholders || directPlaceholder) {
      // eslint-disable-next-line no-console
      console.warn('[text block] Suppressing unresolved ETL placeholder content:', bodyCell.textContent.trim());
      if (block.closest('.section')) {
        block.closest('.section').classList.add('text-placeholder-suppressed');
      }
      block.hidden = true;
      return;
    }
  }

  // --- 3. Build output DOM ---------------------------------------------------
  const fragment = document.createDocumentFragment();

  // Render title as h2 when present and not a placeholder
  if (titleCell) {
    const titleText = (titleCell.textContent || '').trim();
    if (titleText && !isPlaceholder(titleCell)) {
      const h2 = document.createElement('h2');
      h2.textContent = titleText;
      fragment.appendChild(h2);
    }
  }

  // --- 4. Clean up body cell content -----------------------------------------
  if (bodyCell) {
    // EC-text-003: remove leading paragraphs that contain only whitespace / &nbsp;
    [...bodyCell.children].forEach((el) => {
      if (el.tagName === 'P' && !el.textContent.trim().replace(/\u00a0/g, '')) {
        el.remove();
      }
    });

    // EC-text-002: strip empty anchor elements (href present, no visible text).
    bodyCell.querySelectorAll('a').forEach((a) => {
      if (!a.textContent.trim() && !a.children.length) {
        a.remove();
      }
    });

    // Promote body cell content into the fragment
    fragment.append(...bodyCell.childNodes);
  }

  // --- 5. Swap block content -------------------------------------------------
  block.innerHTML = '';
  block.appendChild(fragment);
}
