/**
 * MFE VIEWER · <todo-viewer api-url="…">  (Lit, Custom Element)
 *
 * Lectura:   GET /todos · GET /todos/{id} · GET /todos/{id}/history
 * Emite:     todo:selected → { id, title, completed }          (en window)
 * Escucha:   todo:created · todo:updated · todo:deleted         (en window)
 *
 * Lit ya es un Custom Element con Shadow DOM: LitElement extiende HTMLElement.
 * Las plantillas html`` insertan el texto como nodos de texto (escapado),
 * así que lo que devuelve la API nunca se interpreta como HTML.
 */
import { LitElement, html, css } from 'lit';

export const version = __VERSION__;

class TodoViewer extends LitElement {
  static properties = {
    apiUrl: { type: String, attribute: 'api-url' },
    _estado: { state: true },     // 'cargando' | 'ok' | 'error'
    _error: { state: true },
    _todos: { state: true },
    _sel: { state: true },        // id de la tarea abierta
    _detalle: { state: true },    // { estado, todo?, error? }
    _historial: { state: true },  // { estado, eventos?, error? }
  };

  constructor() {
    super();
    this.apiUrl = '';
    this._estado = 'cargando';
    this._todos = [];
    this._sel = null;
    this._detalle = null;
    this._historial = null;
    this._alEscribir = this._alEscribir.bind(this);
  }

  // ---------- ciclo de vida: alta y limpieza de oyentes ----------

  connectedCallback() {
    super.connectedCallback();
    for (const ev of ['todo:created', 'todo:updated', 'todo:deleted']) {
      window.addEventListener(ev, this._alEscribir);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    for (const ev of ['todo:created', 'todo:updated', 'todo:deleted']) {
      window.removeEventListener(ev, this._alEscribir);
    }
  }

  willUpdate(cambios) {
    // Carga en cuanto llega (o cambia) el atributo api-url
    if (cambios.has('apiUrl') && this.apiUrl) this._cargarLista();
  }

  // ---------- utilidades ----------

  get _base() {
    return (this.apiUrl || '').replace(/\/+$/, '');
  }

  async _pedir(ruta) {
    if (!this._base) throw new Error('Falta el atributo api-url');
    const r = await fetch(this._base + ruta, { cache: 'no-store' });
    const cuerpo = await r.json().catch(() => null);
    if (!r.ok) throw new Error(cuerpo?.message || `HTTP ${r.status}`);
    return cuerpo;
  }

  _fecha(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('es-CO');
  }

  _alEscribir(e) {
    // Si borraron la tarea que estaba abierta, se cierra el detalle
    if (e.type === 'todo:deleted' && e.detail?.id === this._sel) {
      this._sel = null;
      this._detalle = null;
      this._historial = null;
    } else if (this._sel && e.detail?.id === this._sel) {
      this._abrir({ id: this._sel }, false);   // refresca detalle e historial
    }
    this._cargarLista();
  }

  // ---------- GET /todos ----------

  async _cargarLista() {
    this._estado = 'cargando';
    try {
      const todos = await this._pedir('');
      this._todos = Array.isArray(todos) ? todos : [];
      this._estado = 'ok';
    } catch (e) {
      this._error = e.message;
      this._estado = 'error';
    }
  }

  // ---------- GET /todos/{id} + GET /todos/{id}/history ----------

  async _abrir(t, avisar = true) {
    this._sel = t.id;
    if (avisar) {
      window.dispatchEvent(new CustomEvent('todo:selected', {
        detail: { id: t.id, title: t.title, completed: Boolean(t.completed) },
      }));
    }
    this._detalle = { estado: 'cargando' };
    this._historial = { estado: 'cargando' };
    const id = encodeURIComponent(t.id);

    try {
      this._detalle = { estado: 'ok', todo: await this._pedir(`/${id}`) };
    } catch (e) {
      this._detalle = { estado: 'error', error: e.message };
      this._historial = null;
      return;
    }
    try {
      const eventos = await this._pedir(`/${id}/history`);
      this._historial = { estado: 'ok', eventos: Array.isArray(eventos) ? eventos : [] };
    } catch (e) {
      this._historial = { estado: 'error', error: e.message };
    }
  }

  // ---------- plantillas ----------

  _lista() {
    if (this._estado === 'cargando' && !this._todos.length) {
      return html`<p class="estado">Cargando tareas…</p>`;
    }
    if (this._estado === 'error') {
      return html`<p class="estado err">No se pudo cargar la lista — ${this._error}</p>`;
    }
    if (!this._todos.length) {
      return html`<p class="estado">Todavía no hay tareas. Crea la primera desde el editor.</p>`;
    }
    return html`
      <ul>
        ${this._todos.map((t) => html`
          <li class=${t.completed ? 'done' : ''} role="button" tabindex="0"
              aria-selected=${String(t.id === this._sel)}
              @click=${() => this._abrir(t)}
              @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._abrir(t); } }}>
            <span class="tit">${t.title ?? '(sin título)'}</span>
            <span class="pill ${t.completed ? 'ok' : ''}">${t.completed ? 'completada' : 'pendiente'}</span>
          </li>`)}
      </ul>`;
  }

  _panelDetalle() {
    const d = this._detalle;
    if (!d) return '';
    if (d.estado === 'cargando') return html`<p class="estado">Cargando detalle…</p>`;
    if (d.estado === 'error') {
      return html`<p class="estado err">No se pudo abrir la tarea — ${d.error}</p>`;
    }
    const t = d.todo;
    const h = this._historial;
    return html`
      <div class="detalle">
        <h4>${t.title ?? '(sin título)'}</h4>
        <p class="meta">
          id: ${t.id} · ${t.completed ? 'completada' : 'pendiente'} · creada: ${this._fecha(t.createdAt)}
        </p>
        <p class="sub">Historial de eventos</p>
        ${!h || h.estado === 'cargando'
          ? html`<p class="estado">Cargando historial…</p>`
          : h.estado === 'error'
            ? html`<p class="estado err">No se pudo cargar el historial — ${h.error}</p>`
            : !h.eventos.length
              ? html`<p class="estado">Sin eventos registrados todavía.</p>`
              : html`<table>
                  ${h.eventos.map((ev) => html`
                    <tr><td>${ev.eventType ?? '—'}</td><td>${this._fecha(ev.occurredAt)}</td></tr>`)}
                </table>`}
      </div>`;
  }

  render() {
    return html`
      <div class="head">
        <h3>Tareas</h3>
        <button id="refrescar" type="button" ?disabled=${this._estado === 'cargando'}
                @click=${() => this._cargarLista()}>Refrescar</button>
      </div>
      <div id="lista">${this._lista()}</div>
      <div id="detalle">${this._panelDetalle()}</div>
      <p class="marca">Lit 3 · Custom Element</p>
    `;
  }

  static styles = css`
    :host {
      --panel: #1b2735; --line: #2c3a4a; --txt: #e6edf3; --dim: #9fb3c8;
      --acc: #ff9900; --ok: #35c759; --err: #ff453a;
      display: block; color: var(--txt);
      font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    h3 { margin: 0; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--dim); }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
    button {
      padding: 7px 12px; border-radius: 7px; border: 1px solid var(--line);
      background: #24303d; color: var(--txt); font: inherit; font-size: 13px; cursor: pointer;
    }
    button:hover:not(:disabled) { border-color: var(--acc); }
    button:disabled { opacity: .5; cursor: not-allowed; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
    li {
      background: var(--panel); border: 1px solid var(--line); border-radius: 9px;
      padding: 10px 12px; cursor: pointer; display: flex; align-items: center; gap: 10px;
    }
    li:hover { border-color: var(--acc); }
    li[aria-selected=true] { border-color: var(--acc); background: #22303f; }
    li .tit { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    li.done .tit { text-decoration: line-through; color: var(--dim); }
    .pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; white-space: nowrap; border: 1px solid var(--line); color: var(--dim); }
    .pill.ok { color: var(--ok); border-color: #1f4430; }
    .estado { color: var(--dim); font-size: 14px; padding: 14px 0; margin: 0; }
    .estado.err { color: var(--err); }
    .detalle { margin-top: 14px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; }
    .detalle h4 { margin: 0 0 4px; font-size: 16px; overflow-wrap: anywhere; }
    .meta { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11.5px; color: var(--dim); word-break: break-all; margin: 0; }
    .sub { margin: 14px 0 7px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--dim); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td { padding: 5px 0; border-top: 1px solid var(--line); vertical-align: top; }
    td:first-child { color: var(--acc); white-space: nowrap; padding-right: 14px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }
    td:last-child { color: var(--dim); text-align: right; white-space: nowrap; }
    .marca { margin: 12px 0 0; font-size: 11px; color: var(--dim); opacity: .6; text-align: right; }
  `;
}

// Protege contra una doble importación del módulo
if (!customElements.get('todo-viewer')) {
  customElements.define('todo-viewer', TodoViewer);
}
