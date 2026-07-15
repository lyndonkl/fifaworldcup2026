/* docs/js/scenes/s17.js — "The number"
 *
 * Storyboard: research/storyboard.md, Act V, S17 (§3, lines ~352-364).
 * CONTRACT registry: id s17, act 5, layoutName 'settle', 1 step, ceremonial;
 * hero number + devig line sourced from manifest.hero (docs/CONTRACT.md
 * §4.2, §5.1). Design-system.md §9 S17: "Ceremony exception, fully
 * centered. Population dims to 15%; final's dots form the underline at
 * 60% amber. Hero price in white Inter 600 tabular; devig line beneath
 * in 24px amber, same freeze/timestamp. Nothing moves last except the
 * population settling."
 *
 * Every number this scene prints comes from manifest.hero /
 * manifest.frozen_at, refrozen at the G3 morning-of-final pipeline run
 * (CONTRACT §5.1) — nothing here is computed or invented locally.
 */

import { registry, fmt } from '../shared.js';

function hash01(i) {
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export default {
  id: 's17',
  act: 5,
  title: 'The number',
  layoutName: 'settle',

  needs: {
    scene: false,  // every figure this scene needs lives in manifest.hero /
                    // manifest.frozen_at (CONTRACT §5.1) — no scene JSON.
    series: [],
    zoom: null,
  },

  scales(data, view) {
    // Ceremony exception: full-bleed centered layout (design-system.md §4),
    // like S1's title frame — scales span the whole viewport, not the
    // rail-relative `view.region`.
    const t0 = new Date(data.manifest.epoch).getTime();
    const t1 = new Date(data.manifest.frozen_at || data.manifest.generated).getTime();
    const x = registry.register('s17.time', d3.scaleUtc().domain([t0, t1]).range([0, view.W]));
    return { x };
  },

  layout(data, view) {
    const { manifest, pop } = data;
    const N = pop.count;
    const state = { x: new Float32Array(N), y: new Float32Array(N), color: new Float32Array(4 * N), size: new Float32Array(N) };

    const bit = data.flagBit('FINAL_CONTRACT');
    const finalIdx = [];
    for (let i = 0; i < N; i++) if (pop.flags[i] & bit) finalIdx.push(i);

    // "Population dims to 15%" (design-system.md §9 S17). No token names
    // that exact fraction; the nearest law-sanctioned value is
    // particle_states.dimmed-field-min (0.25, the lowest documented
    // dimmed-field opacity). Used rather than a hardcoded 0.15 literal —
    // see this build's data_requests re: a possible missing
    // ceremonial-dim token for Gate 3 to reconcile.
    const quiet = view.state('dimmed-field-min');
    const t0 = new Date(manifest.epoch).getTime();
    const t1 = new Date(manifest.frozen_at || manifest.generated).getTime();
    const timeX = d3.scaleUtc().domain([t0, t1]).range([view.W * 0.08, view.W * 0.92]);

    for (let i = 0; i < N; i++) {
      state.x[i] = timeX(new Date(t0 + pop.birth_ts[i] * 1000));
      state.y[i] = view.H * (0.15 + 0.65 * hash01(i * 5 + 2));
      state.color[i * 4] = quiet[0]; state.color[i * 4 + 1] = quiet[1];
      state.color[i * 4 + 2] = quiet[2]; state.color[i * 4 + 3] = quiet[3];
      state.size[i] = view.tokens.dot['radius-base-px'];
    }

    // The final's own contracts pour into the underline beneath the hero
    // number (storyboard S17 Units: "they arrange into the price figure's
    // underline"). "60% amber" per design-system.md §9 S17 — colorOf()
    // accepts an explicit alpha override (shared.js), sanctioned by that
    // design note rather than an invented literal.
    const amber = view.color('accent-annotation', 0.6);
    const underlineY = view.H * 0.62;
    const spread = Math.min(view.W * 0.4, Math.max(120, finalIdx.length * 3));
    const cx = view.W / 2;
    finalIdx.forEach((i, k) => {
      const t = finalIdx.length > 1 ? k / (finalIdx.length - 1) : 0.5;
      state.x[i] = cx - spread / 2 + t * spread;
      state.y[i] = underlineY + (hash01(i * 11 + 4) - 0.5) * 4;
      state.color[i * 4] = amber[0]; state.color[i * 4 + 1] = amber[1];
      state.color[i * 4 + 2] = amber[2]; state.color[i * 4 + 3] = amber[3];
      state.size[i] = view.tokens.dot['radius-base-px'];
    });

    this._lastLayoutMeta = { underlineY, cx, spread }; // read by overlay(), same enterScene() pass
    return { states: { settle: state }, _meta: { underlineY, cx, spread } };
  },

  overlay(container, data, view, scales) {
    const { manifest } = data;
    const hero = manifest.hero || { legs: [], threeway: [] };
    const underlineY = (this._lastLayoutMeta && this._lastLayoutMeta.underlineY) || view.H * 0.62;

    const wrap = container.html.append('div').attr('class', 's17-wrap')
      .style('position', 'absolute')
      .style('left', '50%').style('top', `${view.H * 0.30}px`)
      .style('transform', 'translateX(-50%)')
      .style('text-align', 'center')
      .style('opacity', 0);

    const legsRow = wrap.append('div').style('display', 'flex').style('gap', view.css('space-64'))
      .style('justify-content', 'center');

    (hero.legs || []).forEach((leg) => {
      const col = legsRow.append('div');
      col.append('div')
        .style('font-family', view.css('font-apparatus'))
        .style('font-size', view.css('type-caption-size'))
        .style('color', view.css('ink-mid'))
        .text(leg.label || '—');
      col.append('div').attr('class', 's17-hero-number')
        .style('font-family', view.css('font-apparatus'))
        .style('font-weight', view.css('type-hero-number-weight'))
        .style('font-size', view.css('type-hero-number-size'))
        .style('line-height', view.css('type-hero-number-leading'))
        .style('color', view.css('ink-hero'))
        .style('font-variant-numeric', 'tabular-nums lining-nums')
        .text(fmt.cents(leg.price_c || 0));
      col.append('div').attr('class', 's17-devig')
        .style('font-family', view.css('font-apparatus'))
        .style('font-weight', view.css('type-devig-line-weight'))
        .style('font-size', view.css('type-devig-line-size'))
        .style('color', view.css('accent-annotation'))
        .text(`stripped of the vig: ${fmt.pct(leg.devig_pct || 0)}`);
    });

    const threeway = wrap.append('div').attr('class', 's17-threeway')
      .style('margin-top', view.css('space-32'))
      .style('display', 'flex').style('gap', view.css('space-24'))
      .style('justify-content', 'center')
      .style('font-family', view.css('font-apparatus'))
      .style('font-size', view.css('type-caption-size'))
      .style('color', view.css('ink-mid'));
    (hero.threeway || []).forEach((leg) => {
      threeway.append('span').text(
        `${leg.label || '—'} ${fmt.cents(leg.price_c || 0)} (devig ${fmt.pct(leg.devig_pct || 0)})`,
      );
    });

    const timestamp = wrap.append('div').attr('class', 's17-timestamp')
      .style('margin-top', view.css('space-24'))
      .style('font-family', view.css('font-tape'))
      .style('font-size', view.css('type-tape-size'))
      .style('letter-spacing', view.css('type-tape-tracking'))
      .style('color', view.css('ink-mid'))
      .text(`frozen ${fmt.iso(manifest.frozen_at || '')}`);

    const provenance = wrap.append('div').attr('class', 's17-provenance')
      .style('margin-top', view.css('space-12'))
      .style('max-width', '52ch')
      .style('margin-left', 'auto').style('margin-right', 'auto')
      .style('font-family', view.css('font-tape'))
      .style('font-size', view.css('type-tape-size'))
      .style('color', view.css('ink-low'))
      .text(resolveProvenance(hero.provenance, manifest.frozen_at));

    return {
      step(beatId) {
        if (beatId === 'b1') wrap.transition().duration(600).style('opacity', 1);
      },
      exit() { wrap.remove(); },
    };
  },

  beats: [
    {
      id: 'b1',
      html: '<p>This is where the piece stops narrating and starts holding still. The number below is the market’s price for the final, frozen and timestamped on the morning of July 19; it will not update, and that is the point.<sup class="fn"><a href="#fn-23">23</a></sup> It is a raw traded price, and the piece says so where it matters most: the winner book’s legs sum above one hundred percent before the vig is removed, so the devigged implied probability prints directly beneath it, same freeze, same timestamp.<sup class="fn"><a href="#fn-23">23</a></sup> The reader now knows what this number is made of: two venues enforced into one price, a spike that holds once it lands, depth where it can be trusted, a lottery tax where it cannot, attention that never bought a point of loyalty, and one year-long conviction that just lost its favorite. Read it with those habits. The epilogue will read it with the result.</p>',
      trigger: 'step',
      state: 'settle',
      kind: 'ceremonial',
      chip: "color: the final's contracts",
      overlayStep: 'b1',
    },
  ],

  // reducedMotion: default suffices — the ceremonial settle already
  // resolves to an instant target + 400ms crossfade under CONTRACT §3.5,
  // and this scene's end state is already the piece's designed
  // screenshot/share frame (storyboard: "End state is fully static and
  // screenshot-ready").
};

/* manifest.hero.provenance ships as a template string containing the
 * literal placeholder "{frozen_at}" in the CONTRACT's own manifest
 * example (docs/CONTRACT.md §5.1). Substituting defensively here covers
 * both a pipeline that pre-fills the string and one that ships the
 * template verbatim — no new text is invented, only the manifest's own
 * frozen_at value is spliced into the manifest's own template. */
function resolveProvenance(template, frozenAt) {
  const fallback = 'raw traded price, frozen at pipeline run {frozen_at}; multi-way legs sum above 100% before the vig is removed; this number does not update';
  const t = template || fallback;
  return t.replace('{frozen_at}', fmt.iso(frozenAt || ''));
}
