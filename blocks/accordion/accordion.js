/**
 * Accordion block — EDS / Universal Editor
 *
 * Content model (child-item pattern via filter "accordion"):
 *   Each accordion item is a child block row rendered by the UE runtime as:
 *     <div data-aue-component="accordion-item">
 *       <div> <!-- item_title cell --> </div>
 *       <div> <!-- item_body  cell --> </div>
 *     </div>
 *
 * In the block-gallery static fixture each item row is a plain:
 *     <div>
 *       <div> title text </div>
 *       <div> <p>body html</p> </div>
 *     </div>
 *
 * The decorator transforms each row into:
 *     <div class="accordion-item">
 *       <button class="accordion-trigger" aria-expanded="false"
 *               aria-controls="accordion-panel-N" id="accordion-btn-N">
 *         <span class="accordion-trigger-label">…title text…</span>
 *         <span class="accordion-icon" aria-hidden="true"></span>
 *       </button>
 *       <div class="accordion-panel" id="accordion-panel-N"
 *            role="region" aria-labelledby="accordion-btn-N" hidden>
 *         …richtext content…
 *       </div>
 *     </div>
 *
 * Accessibility: ARIA Authoring Practices Guide accordion pattern.
 * Keyboard: Enter/Space toggles; Down/Up Arrow move focus between triggers.
 */

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children];
  const blockId = `accordion-${Math.random().toString(36).slice(2, 8)}`;

  const items = rows.map((row, index) => {
    // Two SSR shapes are possible per item:
    //   (a) Block-gallery / un-collapsed: row has two child cells,
    //       cells[0] = title, cells[1] = body.
    //   (b) aem.live SSR row-collapse: when title and body are adjacent
    //       rich-text fields on the same row, SSR merges them into a single
    //       cell containing both <p>s. cells.length === 1, inner has the
    //       title <p> followed by the body content.
    // Detect (b) and split so titleCell/bodyCell behave the same downstream.
    const cells = [...row.children];
    let titleCell;
    let bodyCell;
    if (cells.length >= 2) {
      [titleCell, bodyCell] = cells;
    } else if (cells.length === 1) {
      const inner = cells[0];
      const innerChildren = [...inner.children];
      if (innerChildren.length >= 2) {
        titleCell = document.createElement('div');
        titleCell.append(innerChildren[0]);
        bodyCell = document.createElement('div');
        bodyCell.append(...innerChildren.slice(1));
      } else {
        titleCell = inner;
        bodyCell = null;
      }
    }

    // ── Build trigger button ─────────────────────────────────────────────────
    const btnId = `${blockId}-btn-${index}`;
    const panelId = `${blockId}-panel-${index}`;

    const trigger = document.createElement('button');
    trigger.className = 'accordion-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panelId);
    trigger.id = btnId;
    trigger.type = 'button';

    const label = document.createElement('span');
    label.className = 'accordion-trigger-label';
    // Use textContent of title cell — item_title is plain text per spec
    label.textContent = titleCell ? (titleCell.textContent || '').trim() : '';

    const icon = document.createElement('span');
    icon.className = 'accordion-icon';
    icon.setAttribute('aria-hidden', 'true');

    trigger.append(label, icon);

    // ── Build panel ──────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.className = 'accordion-panel';
    panel.id = panelId;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', btnId);
    panel.hidden = true;

    if (bodyCell) {
      // Move body cell's children into the panel to preserve rich-text HTML
      // (paragraphs, lists, inline <a> elements)
      panel.innerHTML = bodyCell.innerHTML;

      // EC-accordion-005: suppress empty <p> elements in panel
      panel.querySelectorAll('p').forEach((p) => {
        if (!p.textContent.trim() && !p.querySelector('img, a, br')) {
          p.style.display = 'none';
        }
      });
    }

    // ── Build item wrapper ───────────────────────────────────────────────────
    const item = document.createElement('div');
    item.className = 'accordion-item';

    // Transfer UE instrumentation attributes from original row to new item wrapper
    [...row.attributes].forEach((attr) => {
      if (attr.name.startsWith('data-aue-') || attr.name.startsWith('data-richtext-')) {
        item.setAttribute(attr.name, attr.value);
      }
    });

    item.append(trigger, panel);
    return { item, trigger, panel };
  });

  // ── Toggle helper ──────────────────────────────────────────────────────────
  function setExpanded(trigger, panel, expanded) {
    trigger.setAttribute('aria-expanded', String(expanded));
    panel.hidden = !expanded;
  }

  // ── Event: click ──────────────────────────────────────────────────────────
  items.forEach(({ trigger, panel }) => {
    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      setExpanded(trigger, panel, !isOpen);
    });
  });

  // ── Event: keyboard navigation (arrow keys) ────────────────────────────────
  const triggers = items.map((it) => it.trigger);
  triggers.forEach((trigger, i) => {
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        triggers[(i + 1) % triggers.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        triggers[(i - 1 + triggers.length) % triggers.length].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        triggers[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        triggers[triggers.length - 1].focus();
      }
    });
  });

  // ── Replace block content ──────────────────────────────────────────────────
  block.replaceChildren(...items.map((it) => it.item));
}
