/**
 * SliceViewer — viewer NIfTI 3D avec navigation par axe unique
 *
 * Usage :
 *   import SliceViewer from './sliceViewer.js';
 *   const viewer = new SliceViewer('container-id', { jobId, shape, suggested, apiBase: '/api' });
 *   viewer.onConfirm = ({ axis, index }) => { ... lancer le recalage ... };
 */

export default class SliceViewer {
  constructor(containerId, { jobId, shape, suggested, apiBase = '/api' }) {
    this.jobId = jobId;
    this.shape = shape; // { x, y, z }
    this.suggested = suggested; // { axis, index }
    this.apiBase = apiBase.replace(/\/$/, '');

    this.maxIndex = {
      axial: shape.z - 1,
      coronal: shape.y - 1,
      sagittal: shape.x - 1,
    };

    this.AXIS_LABELS = {
      axial: 'Axiale',
      coronal: 'Coronale',
      sagittal: 'Sagittale',
    };

    this.state = {
      axis: suggested.axis ?? 'axial',
      indices: {
        axial: suggested.axis === 'axial' ? suggested.index : Math.floor(shape.z / 2),
        coronal: suggested.axis === 'coronal' ? suggested.index : Math.floor(shape.y / 2),
        sagittal: suggested.axis === 'sagittal' ? suggested.index : Math.floor(shape.x / 2),
      },
      selectedAxis: null,
      selectedIndex: null,
      confirmed: false,
    };

    this.fetchCache = new Map();
    this.debounceTimer = null;
    this.onConfirm = null; // callback externe

    this._buildDOM(containerId);
    this._bindEvents();
    this._switchAxis(this.state.axis, false);
  }

  // DOM
  _buildDOM(containerId) {
    const root = document.getElementById(containerId);
    if (!root) {
      throw new Error(`[SliceViewer] container not found: ${containerId}`);
    }

    root.innerHTML = `
      <div class="sv-root">
        <div class="sv-top-row">
          <div class="sv-tabs" id="${containerId}-tabs">
            ${['axial', 'coronal', 'sagittal'].map(a => `
              <button class="sv-tab" data-axis="${a}" id="${containerId}-tab-${a}">
                ${this.AXIS_LABELS[a]}
              </button>`).join('')}
          </div>
          <span class="sv-sugg-tag" id="${containerId}-sugg-tag">
            Suggestion algo
          </span>
        </div>

        <div class="sv-viewer">
          <div class="sv-canvas-wrap" id="${containerId}-wrap">
            <canvas id="${containerId}-canvas" width="512" height="512"></canvas>
            <div class="sv-loader" id="${containerId}-loader">
              <div class="sv-spinner"></div>
            </div>
            <div class="sv-hud">
              <div class="sv-hud-axis" id="${containerId}-hud-axis">Axiale</div>
              <div class="sv-hud-idx"  id="${containerId}-hud-idx">— / —</div>
            </div>
            <div class="sv-sel-ring" id="${containerId}-sel-ring"></div>
          </div>

          <div class="sv-ctrl-row">
            <button class="sv-arrow" id="${containerId}-prev" title="Coupe precedente (←)">&#8592;</button>
            <input class="sv-slider" type="range" id="${containerId}-slider" min="0" max="127" value="64">
            <button class="sv-arrow" id="${containerId}-next" title="Coupe suivante (→)">&#8594;</button>
            <input class="sv-index-input" type="number" id="${containerId}-input" min="1" max="128" value="65">
          </div>

          <div class="sv-status-bar" id="${containerId}-status-bar">
            <div class="sv-dot" id="${containerId}-dot"></div>
            <div class="sv-status-text" id="${containerId}-status-text">
              Naviguez pour choisir une coupe
            </div>
            <button class="sv-btn-validate" id="${containerId}-validate" disabled>
              Valider cette coupe
            </button>
          </div>
        </div>
      </div>`;

    this.el = {
      tabs: root.querySelectorAll('.sv-tab'),
      canvas: document.getElementById(`${containerId}-canvas`),
      loader: document.getElementById(`${containerId}-loader`),
      hudAxis: document.getElementById(`${containerId}-hud-axis`),
      hudIdx: document.getElementById(`${containerId}-hud-idx`),
      selRing: document.getElementById(`${containerId}-sel-ring`),
      slider: document.getElementById(`${containerId}-slider`),
      prev: document.getElementById(`${containerId}-prev`),
      next: document.getElementById(`${containerId}-next`),
      input: document.getElementById(`${containerId}-input`),
      dot: document.getElementById(`${containerId}-dot`),
      statusText: document.getElementById(`${containerId}-status-text`),
      btnVal: document.getElementById(`${containerId}-validate`),
      suggTag: document.getElementById(`${containerId}-sugg-tag`),
      statusBar: document.getElementById(`${containerId}-status-bar`),
    };
  }

  // Events
  _bindEvents() {
    this.el.tabs.forEach(tab => {
      tab.addEventListener('click', () => this._switchAxis(tab.dataset.axis));
    });

    this.el.slider.addEventListener('input', e => {
      this._navigate(parseInt(e.target.value, 10));
    });

    this.el.input.addEventListener('change', e => {
      const v = Math.max(1, Math.min(parseInt(e.target.value, 10) || 1, this.maxIndex[this.state.axis] + 1));
      e.target.value = v;
      this._navigate(v - 1);
    });

    this.el.prev.addEventListener('click', () => {
      this._navigate(Math.max(0, this.state.indices[this.state.axis] - 1));
    });

    this.el.next.addEventListener('click', () => {
      this._navigate(Math.min(this.maxIndex[this.state.axis], this.state.indices[this.state.axis] + 1));
    });

    document.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      e.preventDefault();
      const cur = this.state.indices[this.state.axis];
      const max = this.maxIndex[this.state.axis];
      this._navigate(e.key === 'ArrowRight' ? Math.min(cur + 1, max) : Math.max(cur - 1, 0));
    });

    this.el.btnVal.addEventListener('click', () => this._validate());
  }

  // Navigation
  _switchAxis(axis) {
    this.state.axis = axis;
    const max = this.maxIndex[axis];
    const idx = this.state.indices[axis];

    this.el.tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.axis === axis);
    });

    this.el.slider.max = max;
    this.el.slider.value = idx;
    this.el.input.max = max + 1;
    this.el.input.value = idx + 1;
    this.el.hudAxis.textContent = this.AXIS_LABELS[axis];

    this.state.selectedAxis = null;
    this.state.selectedIndex = null;
    this.el.selRing.classList.remove('show');
    this._updateStatus('idle');

    this._fetchAndDraw(axis, idx);
  }

  _navigate(index) {
    const axis = this.state.axis;
    index = Math.max(0, Math.min(index, this.maxIndex[axis]));
    this.state.indices[axis] = index;

    this.el.slider.value = index;
    this.el.input.value = index + 1;

    this.state.selectedAxis = null;
    this.state.selectedIndex = null;
    this.el.selRing.classList.remove('show');
    this._updateStatus('navigating');

    this._fetchAndDraw(axis, index);

    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.state.selectedAxis = axis;
      this.state.selectedIndex = index;
      this.el.selRing.classList.add('show');
      this._updateStatus('selected');
      this._prefetch(axis, index - 1);
      this._prefetch(axis, index + 1);
    }, 800);
  }

  // Fetch
  async _fetchAndDraw(axis, index) {
    const cacheKey = `${this.jobId}|${axis}|${index}`;

    if (this.fetchCache.has(cacheKey)) {
      this._drawDataUrl(this.fetchCache.get(cacheKey), axis, index);
      return;
    }

    this.el.loader.classList.add('visible');

    try {
      const params = new URLSearchParams({ jobId: this.jobId, axis, index });
      const res = await fetch(`${this.apiBase}/volume/get-slice?${params.toString()}`);

      if (!res.ok) {
        const err = await res.json();
        console.error('[SliceViewer] fetch error:', err);
        return;
      }

      const data = await res.json();
      this.fetchCache.set(cacheKey, data.slice);
      this._drawDataUrl(data.slice, axis, index);
    } catch (e) {
      console.error('[SliceViewer] network error:', e);
    } finally {
      this.el.loader.classList.remove('visible');
    }
  }

  _drawDataUrl(dataUrl, axis, index) {
    const img = new Image();
    img.onload = () => {
      const ctx = this.el.canvas.getContext('2d');
      ctx.clearRect(0, 0, this.el.canvas.width, this.el.canvas.height);
      ctx.drawImage(img, 0, 0, this.el.canvas.width, this.el.canvas.height);
      this.el.hudIdx.textContent = `${index + 1} / ${this.maxIndex[axis] + 1}`;
    };
    img.src = dataUrl;
  }

  async _prefetch(axis, index) {
    if (index < 0 || index > this.maxIndex[axis]) return;
    const cacheKey = `${this.jobId}|${axis}|${index}`;
    if (this.fetchCache.has(cacheKey)) return;

    try {
      const params = new URLSearchParams({ jobId: this.jobId, axis, index });
      const res = await fetch(`${this.apiBase}/volume/get-slice?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        this.fetchCache.set(cacheKey, data.slice);
      }
    } catch (_) {
      // Ignore prefetch errors
    }
  }

  // Status bar
  _updateStatus(state) {
    const dot = this.el.dot;
    const text = this.el.statusText;
    const btn = this.el.btnVal;

    const isSuggested =
      this.state.selectedAxis === this.suggested.axis &&
      this.state.selectedIndex === this.suggested.index;

    this.el.suggTag.style.display =
      (this.state.axis === this.suggested.axis && this.state.indices[this.state.axis] === this.suggested.index)
        ? 'inline-flex' : 'none';

    switch (state) {
      case 'navigating':
        dot.className = 'sv-dot selecting';
        text.innerHTML = `Navigation - vue <strong>${this.AXIS_LABELS[this.state.axis]}</strong>`;
        btn.disabled = true;
        break;

      case 'selected': {
        const idx = this.state.selectedIndex;
        dot.className = 'sv-dot selected';
        text.innerHTML =
          `Coupe selectionnee - <strong>${this.AXIS_LABELS[this.state.selectedAxis]} n°${idx + 1}</strong>` +
          (isSuggested ? ' <small>(suggeree par l\'algo)</small>' : '');
        btn.disabled = false;
        break;
      }

      default:
        dot.className = 'sv-dot';
        text.textContent = 'Naviguez pour choisir une coupe';
        btn.disabled = true;
    }
  }

  // Validation
  async _validate() {
    if (!this.state.selectedAxis) return;

    const axis = this.state.selectedAxis;
    const index = this.state.selectedIndex;

    this.el.btnVal.disabled = true;
    this.el.btnVal.textContent = 'Confirmation...';

    try {
      const res = await fetch(`${this.apiBase}/volume/confirm-slice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: this.jobId, axis, index }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('[SliceViewer] confirm error:', err);
        this.el.btnVal.disabled = false;
        this.el.btnVal.textContent = 'Valider cette coupe';
        return;
      }

      this.state.confirmed = true;
      this._showConfirmedBadge(axis, index);

      if (typeof this.onConfirm === 'function') {
        this.onConfirm({ axis, index });
      }
    } catch (e) {
      console.error('[SliceViewer] network error on confirm:', e);
      this.el.btnVal.disabled = false;
      this.el.btnVal.textContent = 'Valider cette coupe';
    }
  }

  _showConfirmedBadge(axis, index) {
    this.el.statusBar.innerHTML = `
      <span class="sv-confirmed-badge">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" stroke-width="1.2"/>
          <path d="M4.5 7.5l2.2 2.2L10.5 5" stroke="currentColor"
            stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Vue ${this.AXIS_LABELS[axis]} - coupe ${index + 1} confirmee
      </span>
      <button class="sv-btn-change" id="sv-btn-change">Modifier</button>`;

    const btnChange = document.getElementById('sv-btn-change');
    if (btnChange) {
      btnChange.addEventListener('click', () => {
        this._resetConfirm(axis, index);
      });
    }
  }

  _resetConfirm(axis, index) {
    this.state.confirmed = false;
    this.state.selectedAxis = axis;
    this.state.selectedIndex = index;

    this.el.statusBar.innerHTML = `
      <div class="sv-dot selected" id="${this.el.dot.id}"></div>
      <div class="sv-status-text" id="${this.el.statusText.id}">
        Coupe selectionnee - <strong>${this.AXIS_LABELS[axis]} n°${index + 1}</strong>
      </div>
      <button class="sv-btn-validate" id="${this.el.btnVal.id}">Valider cette coupe</button>`;

    this.el.dot = this.el.statusBar.querySelector('.sv-dot');
    this.el.statusText = this.el.statusBar.querySelector('.sv-status-text');
    this.el.btnVal = this.el.statusBar.querySelector('.sv-btn-validate');
    this.el.btnVal.addEventListener('click', () => this._validate());

    this.el.selRing.classList.add('show');
  }
}
