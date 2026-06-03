import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Accordion block — ComplaintProcessGuide
 *
 * DOM contract (AEM Franklin / EDS vertical format):
 *   Each authored row has two cells:
 *     col 0 → item_title  (trigger text)
 *     col 1 → item_body   (richtext panel content)
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
export default function decorate(block) {
  const rows = [...block.children];

  // Compute a stable block index for unique IDs — must not use module-scope counter.
  // querySelectorAll is called once here, before DOM rebuild.
  const blockIndex = Array.from(document.querySelectorAll('.accordion.block')).indexOf(block);

  // Build new accordion structure
  const container = document.createElement('div');
  container.className = 'accordion-items';

  // Transfer block-level UE instrumentation to container
  moveInstrumentation(block, container);

  rows.forEach((row, index) => {
    const cells = [...row.children];
    const titleCell = cells[0] || row;
    const bodyCell = cells[1] || null;

    // Create wrapper item
    const item = document.createElement('div');
    item.className = 'accordion-item';

    // Create trigger button — IDs are unique per block instance and item index
    const panelId = `accordion-panel-${blockIndex}-${index}`;
    const triggerId = `accordion-trigger-${blockIndex}-${index}`;

    const trigger = document.createElement('button');
    trigger.className = 'accordion-trigger';
    trigger.id = triggerId;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', panelId);
    trigger.textContent = titleCell.textContent.trim();

    // Transfer row-level UE instrumentation to trigger
    moveInstrumentation(row, item);

    // Transfer title-cell UE prop to trigger
    const titlePara = titleCell.querySelector(
      '[data-aue-prop], [data-richtext-prop]',
    ) || titleCell;
    moveInstrumentation(titlePara, trigger);

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'accordion-panel';
    panel.id = panelId;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', triggerId);
    panel.hidden = true;

    if (bodyCell) {
      // Transfer body-cell UE instrumentation
      const bodyPara = bodyCell.querySelector(
        '[data-aue-prop], [data-richtext-prop]',
      ) || bodyCell;
      const panelInner = document.createElement('div');
      panelInner.className = 'accordion-panel-inner';
      // Move richtext children into inner div
      [...bodyCell.childNodes].forEach((node) => panelInner.appendChild(node));
      moveInstrumentation(bodyPara, panelInner);
      panel.appendChild(panelInner);
    }

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

    item.appendChild(trigger);
    item.appendChild(panel);
    container.appendChild(item);
  });

  block.replaceChildren(container);
}
