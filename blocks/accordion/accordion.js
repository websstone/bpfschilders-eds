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
 *       <button class="accordion-trigger" aria-expanded="false" aria-controls="accordion-panel-N" id="accordion-btn-N">
 *         <span class="accordion-trigger-label">…title text…</span>
 *         <span class="accordion-icon" aria-hidden="true"></span>
 *       </button>
 *       <div class="accordion-panel" id="accordion-panel-N" role="region" aria-labelledby="accordion-btn-N" hidden>
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
    // Each row has two child divs: title cell and body cell
    const cells = [...row.children];
    const titleCell = cells[0];
    const bodyCell = cells[1];

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
