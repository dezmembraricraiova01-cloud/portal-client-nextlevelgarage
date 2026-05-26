/**
 * Svelte action reutilizabil pentru drag-and-drop cu SortableJS.
 *
 * Utilizare minimă:
 *   <div use:sortable={'cheie-unica'}>
 *     <div data-sort-id="a">Card A</div>
 *     <div data-sort-id="b">Card B</div>
 *   </div>
 *
 * Utilizare cu opțiuni:
 *   <div use:sortable={{ key: 'docs', direction: 'horizontal', idAttr: 'data-tip' }}>
 *
 * Ordinea se salvează în localStorage la cheia `nlg-sort:{key}`.
 */

import Sortable from 'sortablejs';

export type SortableOpts = {
    key:         string;
    idAttr?:     string;          // atribut cu ID-ul stabil al itemului (default: 'data-sort-id')
    direction?:  'horizontal' | 'vertical';
    delay?:      number;          // ms long-press pe touch (default: 200)
};

const PREFIX = 'nlg-sort:';

function resolveOpts(raw: SortableOpts | string): Required<SortableOpts> {
    const o = typeof raw === 'string' ? { key: raw } : raw;
    return {
        key:       o.key,
        idAttr:    o.idAttr    ?? 'data-sort-id',
        direction: o.direction ?? 'vertical',
        delay:     o.delay     ?? 200,
    };
}

export function sortable(node: HTMLElement, raw: SortableOpts | string) {
    const { key, idAttr, direction, delay } = resolveOpts(raw);
    const storageKey = PREFIX + key;

    function getItems() {
        return [...node.querySelectorAll<HTMLElement>(`[${idAttr}]`)];
    }

    // ── Aplică ordinea salvată ────────────────────────────────────────────────
    try {
        const saved: string[] = JSON.parse(localStorage.getItem(storageKey) ?? 'null') ?? [];
        if (saved.length) {
            getItems()
                .sort((a, b) => {
                    const ai = saved.indexOf(a.getAttribute(idAttr)!);
                    const bi = saved.indexOf(b.getAttribute(idAttr)!);
                    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                })
                .forEach(el => node.appendChild(el));
        }
    } catch { /* localStorage indisponibil sau JSON invalid */ }

    // ── Inițializează SortableJS ──────────────────────────────────────────────
    const s = Sortable.create(node, {
        animation:        150,
        direction,
        delay,
        delayOnTouchOnly: true,
        ghostClass:       'sortable-ghost',
        chosenClass:      'sortable-chosen',
        onEnd() {
            const order = getItems().map(el => el.getAttribute(idAttr)!);
            try { localStorage.setItem(storageKey, JSON.stringify(order)); } catch {}
        },
    });

    return {
        destroy() { s.destroy(); },
    };
}
