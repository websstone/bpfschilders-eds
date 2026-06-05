import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Accordion block — ComplaintProcessGuide
 *
 * DOM contract (AEM Franklin / EDS vertical format):
 *   Each authored row has two cells:
 *     col 0 → item_title  (trigger text)
 *     col 1 → item_body   (richtext panel content)
 *
 * JCR fallback: when aem.live renders accordion-item nodes whose fields are
 * stored as scalar JCR properties, the table cells are empty <div> elements.
 * In that case this decorator fetches each item's <jcr-path>.json (path from
 * data-aue-resource URN on the row) and reads item_title + item_body from the
 * JSON properties. item_body is richtext HTML and is set via innerHTML.
 *
 * Backward compat: if cells already contain text (gallery fixture / non-imported
 * pages), the cell content is used and no fetch is attempted.
 *
 * Behaviour (from behavioral-spec.yaml):
 *   - All panels collapsed on load (aria-expanded="false", panel hidden).
 *   - Single-open: opening one panel closes any previously open panel.
 *   - Second click on an open trigger collapses it.
 *   - Keyboard: Enter / Space activate the button (native button behaviour).
 *   - State stored on DOM (dataset) — no module-scope mutable state.
 *
 * Visual spec (from visual-spec.yaml + source-screenshot.desktop.png):
 *   Closed trigger: background rgb(245,245,245), color rgb(51,51,51),
 *                   ::after shows purple "+" indicator square.
 *   Open trigger:   background rgb(68,35,89) (brand purple), color white,
 *                   ::after shows white "×" indicator.
 *   Panel:          white background, padding 1rem 1.25rem, display:none when closed.
 *   Root:           white bg, 1px solid rgb(204,204,204) border.
 *
 * @param {Element} block
 */

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
 * Fetch JCR node properties as JSON via the dev-server same-origin proxy.
 * @param {string} path JCR path (e.g. "/content/bpfschilders-eds/…/node")
 * @returns {Promise<Object|null>}
 */
async function fetchJcr(path) {
  if (!path) return null;
  try {
    const resp = await fetch(`${path}.json`);
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

/**
 * Returns true when a cell is considered empty (no meaningful text or child elements).
 * A cell containing only whitespace or empty sub-divs qualifies as empty.
 * @param {Element|null} cell
 * @returns {boolean}
 */
function isCellEmpty(cell) {
  if (!cell) return true;
  return cell.textContent.trim() === '' && !cell.querySelector('img, picture, video, iframe');
}

/**
 * Build one accordion item element.
 * @param {Element} row         — source row element (for moveInstrumentation)
 * @param {string}  title       — trigger label text
 * @param {string}  bodyHtml    — panel content HTML (may be empty)
 * @param {string}  panelId
 * @param {string}  triggerId
 * @returns {{ item: HTMLElement, trigger: HTMLButtonElement, panel: HTMLElement }}
 */
function buildItem(row, title, bodyHtml, panelId, triggerId) {
  const cells = [...row.children];
  const titleCell = cells[0] || row;
  const bodyCell = cells[1] || null;

  const item = document.createElement('div');
  item.className = 'accordion-item';
  moveInstrumentation(row, item);

  const trigger = document.createElement('button');
  trigger.className = 'accordion-trigger';
  trigger.id = triggerId;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', panelId);
  trigger.textContent = title;

  // Transfer title-cell UE prop to trigger when present
  const titlePara = titleCell.querySelector('[data-aue-prop], [data-richtext-prop]') || titleCell;
  moveInstrumentation(titlePara, trigger);

  const panel = document.createElement('div');
  panel.className = 'accordion-panel';
  panel.id = panelId;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', triggerId);
  panel.hidden = true;

  const panelInner = document.createElement('div');
  panelInner.className = 'accordion-panel-inner';

  if (bodyHtml) {
    // JCR-sourced content: if it contains HTML tags treat as richtext, otherwise
    // render plain text preserving paragraph breaks.
    if (/<[a-z][\s\S]*>/i.test(bodyHtml)) {
      panelInner.innerHTML = bodyHtml;
    } else {
      // Split on single or double newlines; each segment becomes a <p>.
      bodyHtml.split(/\n+/).filter(Boolean).forEach((para) => {
        const p = document.createElement('p');
        p.textContent = para.trim();
        panelInner.appendChild(p);
      });
    }
  } else if (bodyCell && !isCellEmpty(bodyCell)) {
    // Cell-sourced content: move child nodes.
    [...bodyCell.childNodes].forEach((node) => panelInner.appendChild(node));
  }

  // Transfer body-cell / panelInner UE instrumentation when a cell exists.
  if (bodyCell) {
    const bodyPara = bodyCell.querySelector('[data-aue-prop], [data-richtext-prop]') || bodyCell;
    moveInstrumentation(bodyPara, panelInner);
  }

  panel.appendChild(panelInner);
  item.appendChild(trigger);
  item.appendChild(panel);

  return { item, trigger, panel };
}

/**
 * Derive trigger title + panel body from raw item_title/item_body values.
 * Handles the well-formed case (separate title + body) and the item_body-only
 * form produced by the import, where the first line is the trigger and the rest
 * (if any) is the panel.
 * @param {string} itemTitle
 * @param {string} rawBody
 * @returns {{title: string, bodyHtml: string}}
 */
function deriveItem(itemTitle, rawBody) {
  if (itemTitle) return { title: itemTitle, bodyHtml: rawBody };
  if (rawBody) {
    const nl = rawBody.indexOf('\n');
    if (nl !== -1) {
      return {
        title: rawBody.slice(0, nl).trim(),
        bodyHtml: rawBody.slice(nl + 1).replace(/^\n+/, '').trim(),
      };
    }
    return { title: rawBody.trim(), bodyHtml: '' };
  }
  return { title: '', bodyHtml: '' };
}

/**
 * Loads and decorates the accordion block.
 * @param {Element} block
 */
export default async function decorate(block) {
  const rows = [...block.children];

  // Compute a stable block index for unique IDs — must not use module-scope counter.
  const blockIndex = Array.from(document.querySelectorAll('.accordion.block')).indexOf(block);

  // ── Resolve title + body for every row in parallel ──────────────────────
  // Prefer the delivered cells (model order: item_title, item_body) — the only
  // data source on the published site. Fall back to the JCR .json fetch for the
  // author/UE context, where the cells render empty.
  const resolved = await Promise.all(
    rows.map(async (row, index) => {
      const cells = [...row.children];
      const titleCell = cells[0] || row;
      const bodyCell = cells[1] || null;

      let itemTitle = titleCell.textContent.trim();
      let rawBody = bodyCell && !isCellEmpty(bodyCell) ? bodyCell.innerHTML.trim() : '';

      // Author/UE fallback: cells empty but the JCR node is reachable same-origin.
      if (!itemTitle && !rawBody) {
        const data = await fetchJcr(jcrPath(row));
        itemTitle = (data && data.item_title) ? String(data.item_title).trim() : '';
        rawBody = (data && data.item_body) ? String(data.item_body) : '';
      }

      const { title, bodyHtml } = deriveItem(itemTitle, rawBody);
      return {
        row, index, title, bodyHtml,
      };
    }),
  );

  // ── Pair question-only + answer-only rows when item_title is absent ────────
  // Source data for klacht stores question and answer as two consecutive JCR
  // items, both with item_body only and no item_title. The question item has an
  // empty bodyHtml (single line, ends with "?"); the next item contains the
  // answer text. Merge each such pair into one accordion entry so the answer
  // is hidden in the panel rather than shown as a standalone button label.
  const paired = [];
  let i = 0;
  while (i < resolved.length) {
    const cur = resolved[i];
    const next = resolved[i + 1];
    // Pair when: current title looks like a question (ends with "?"), current
    // bodyHtml is empty, AND next item has a title that does not end with "?"
    // and also has an empty bodyHtml — i.e., both are raw item_body scalars.
    const curIsQuestion = cur.title.trim().endsWith('?') && (cur.bodyHtml === '' || cur.bodyHtml === null);
    const nextIsAnswer = next
      && !next.title.trim().endsWith('?')
      && (next.bodyHtml === '' || next.bodyHtml === null);

    if (curIsQuestion && nextIsAnswer) {
      // Merge: question title + answer text as body
      paired.push({
        row: cur.row,
        index: cur.index,
        title: cur.title,
        bodyHtml: next.title, // answer text
      });
      i += 2;
    } else {
      paired.push(cur);
      i += 1;
    }
  }

  // ── Build accordion DOM ──────────────────────────────────────────────────
  const container = document.createElement('div');
  container.className = 'accordion-items';
  moveInstrumentation(block, container);

  paired.forEach(({
    row, index, title, bodyHtml,
  }) => {
    const panelId = `accordion-panel-${blockIndex}-${index}`;
    const triggerId = `accordion-trigger-${blockIndex}-${index}`;

    // When bodyHtml is null, buildItem falls back to DOM child nodes.
    const { item, trigger, panel } = buildItem(
      row,
      title,
      bodyHtml === null ? '' : bodyHtml,
      panelId,
      triggerId,
    );

    // Click handler — single-open behaviour
    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      // Collapse all items in this block
      container.querySelectorAll('.accordion-trigger').forEach((btn) => {
        btn.setAttribute('aria-expanded', 'false');
        const controlledPanel = document.getElementById(btn.getAttribute('aria-controls'));
        if (controlledPanel) controlledPanel.hidden = true;
      });

      // If it was closed before click, open it; if it was open, leave collapsed
      if (!isOpen) {
        trigger.setAttribute('aria-expanded', 'true');
        panel.hidden = false;
      }
    });

    container.appendChild(item);
  });

  block.replaceChildren(container);
}
