/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

// eslint-disable-next-line import/no-cycle
import {
  decorateMain,
  moveInstrumentation,
} from '../../scripts/scripts.js';

import {
  loadSections,
} from '../../scripts/aem.js';

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
export async function loadFragment(path) {
  if (path && path.startsWith('/') && !path.startsWith('//')) {
    // eslint-disable-next-line no-param-reassign
    path = path.replace(/(\.plain)?\.html/, '');
    const resp = await fetch(`${path}.plain.html`);
    if (resp.ok) {
      const main = document.createElement('main');
      main.innerHTML = await resp.text();

      // reset base path for media to fragment base
      const resetAttributeBase = (tag, attr) => {
        main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
          elem[attr] = new URL(elem.getAttribute(attr), new URL(path, window.location)).href;
        });
      };
      resetAttributeBase('img', 'src');
      resetAttributeBase('source', 'srcset');

      decorateMain(main);
      await loadSections(main);
      return main;
    }
  }
  return null;
}

export default async function decorate(block) {
  // Capture source row and reference-field paragraph before DOM replacement so
  // their UE instrumentation attributes (data-aue-prop="reference",
  // data-aue-resource, data-aue-component, data-aue-model) can be moved to
  // representative elements in the rebuilt DOM.
  const sourceRow = block.children[0] || null;
  const paragraphs = sourceRow ? [...sourceRow.querySelectorAll('p')] : [];
  const refParagraph = paragraphs.find(
    (p) => p.dataset.aueProp === 'reference' || p.dataset.richtextProp === 'reference',
  ) || paragraphs[0] || null;

  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent.trim();
  const fragment = await loadFragment(path);
  if (fragment) {
    block.replaceChildren(...fragment.childNodes);

    // Re-attach per-field UE instrumentation as a hidden sentinel element.
    // UE walks the post-decoration DOM to locate data-aue-prop bindings; without
    // this sentinel the "reference" field appears uneditable in Universal Editor.
    if (refParagraph) {
      const sentinel = document.createElement('span');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.display = 'none';
      moveInstrumentation(refParagraph, sentinel);
      block.appendChild(sentinel);
    }
  }
}
