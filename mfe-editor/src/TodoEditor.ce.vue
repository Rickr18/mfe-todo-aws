<script setup>
/**
 * MFE EDITOR · <todo-editor api-url="…">  (Vue 3, Custom Element)
 *
 * Escritura:   POST /todos · PUT /todos/{id} · DELETE /todos/{id}
 * Emite:       todo:created · todo:updated · todo:deleted   (en window)
 * Escucha:     todo:selected                                (en window)
 *
 * Vue convierte el atributo HTML `api-url` en la prop `apiUrl`.
 * Todo el texto se pinta con {{ }}, que Vue escapa: nunca se usa v-html.
 */
import { ref, reactive, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  apiUrl: { type: String, default: '' },
});

const nuevo = ref('');
const ocupado = ref(false);
const msgCrear = reactive({ texto: '', clase: 'info' });
const msgEditar = reactive({ texto: '', clase: 'info' });

// Tarea elegida en el viewer. El contrato garantiza { id };
// title y completed son opcionales.
const sel = ref(null);
const titulo = ref('');
const hecha = ref(false);
const confirmar = ref(false);

const base = () => (props.apiUrl || '').replace(/\/+$/, '');

function decir(msg, texto, clase = 'info') {
  msg.texto = texto;
  msg.clase = clase;
}

function emitir(nombre, detail) {
  window.dispatchEvent(new CustomEvent(nombre, { detail }));
}

/** Llama a la API y convierte los errores 400/404 en un mensaje legible. */
async function pedir(ruta, opciones = {}) {
  if (!base()) throw new Error('Falta el atributo api-url');
  const r = await fetch(base() + ruta, {
    ...opciones,
    headers: opciones.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (r.status === 204) return null;
  const cuerpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error(cuerpo?.message || `HTTP ${r.status}`);
  return cuerpo;
}

// ---------- POST /todos ----------
async function crear() {
  const title = nuevo.value.trim();
  if (!title) {
    decir(msgCrear, 'El título no puede estar vacío.', 'err');
    return;
  }
  ocupado.value = true;
  decir(msgCrear, 'Creando…');
  try {
    const todo = await pedir('', { method: 'POST', body: JSON.stringify({ title }) });
    nuevo.value = '';
    decir(msgCrear, `Creada: ${todo.title}`, 'ok');
    emitir('todo:created', todo);
  } catch (e) {
    decir(msgCrear, `No se pudo crear — ${e.message}`, 'err');
  } finally {
    ocupado.value = false;
  }
}

// ---------- PUT /todos/{id} ----------
async function actualizar() {
  if (!sel.value) return;
  const cambios = {};
  const t = titulo.value.trim();
  if (t) cambios.title = t;
  if (hecha.value !== Boolean(sel.value.completed)) cambios.completed = hecha.value;
  if (!Object.keys(cambios).length) {
    decir(msgEditar, 'No hay cambios que guardar.');
    return;
  }
  ocupado.value = true;
  decir(msgEditar, 'Guardando…');
  try {
    const todo = await pedir(`/${encodeURIComponent(sel.value.id)}`, {
      method: 'PUT',
      body: JSON.stringify(cambios),
    });
    sel.value = { id: todo.id, title: todo.title, completed: todo.completed };
    titulo.value = '';
    hecha.value = Boolean(todo.completed);
    decir(msgEditar, `Actualizada: ${todo.title}`, 'ok');
    emitir('todo:updated', todo);
  } catch (e) {
    decir(msgEditar, `No se pudo actualizar — ${e.message}`, 'err');
  } finally {
    ocupado.value = false;
  }
}

// ---------- DELETE /todos/{id} ----------
async function eliminar() {
  if (!sel.value) return;
  const id = sel.value.id;
  confirmar.value = false;
  ocupado.value = true;
  decir(msgEditar, 'Eliminando…');
  try {
    await pedir(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
    emitir('todo:deleted', { id });
    sel.value = null;
    decir(msgCrear, 'Tarea eliminada.', 'ok');
  } catch (e) {
    decir(msgEditar, `No se pudo eliminar — ${e.message}`, 'err');
  } finally {
    ocupado.value = false;
  }
}

// ---------- todo:selected ----------
function alSeleccionar(e) {
  const d = e.detail || {};
  if (!d.id) return;
  sel.value = { id: d.id, title: d.title, completed: Boolean(d.completed) };
  titulo.value = '';
  hecha.value = Boolean(d.completed);
  confirmar.value = false;
  decir(msgEditar, '');
}

// Vue desmonta la app cuando el elemento sale del DOM (disconnectedCallback),
// así que onUnmounted es donde se cumple la limpieza del contrato.
onMounted(() => window.addEventListener('todo:selected', alSeleccionar));
onUnmounted(() => window.removeEventListener('todo:selected', alSeleccionar));
</script>

<template>
  <section class="card">
    <h3>Nueva tarea</h3>
    <label for="nuevo">Título</label>
    <input id="nuevo" v-model="nuevo" type="text" autocomplete="off"
           placeholder="Ej.: Preparar la demo" @keydown.enter="crear">
    <div class="row">
      <button id="crear" class="main" type="button" :disabled="ocupado" @click="crear">Agregar</button>
    </div>
    <p id="msgCrear" :class="['msg', msgCrear.clase]">{{ msgCrear.texto }}</p>
  </section>

  <section v-if="sel" id="panel" class="card">
    <h3>Editar tarea seleccionada</h3>
    <p id="idSel" class="id">id: {{ sel.id }}</p>
    <label for="titulo">Nuevo título <span class="tenue">(vacío = no cambiarlo)</span></label>
    <input id="titulo" v-model="titulo" type="text" autocomplete="off"
           :placeholder="sel.title || 'Nuevo título'">
    <label class="check">
      <input id="hecha" v-model="hecha" type="checkbox"> Marcar como completada
    </label>
    <div class="row">
      <button id="guardar" class="main" type="button" :disabled="ocupado" @click="actualizar">Guardar cambios</button>
      <button id="borrar" class="danger" type="button" :disabled="ocupado" @click="confirmar = true">Eliminar</button>
    </div>
    <div v-show="confirmar" id="confirm" class="confirm">
      <p>¿Eliminar esta tarea? No se puede deshacer.</p>
      <div class="row">
        <button id="siBorrar" class="danger" type="button" @click="eliminar">Sí, eliminar</button>
        <button id="noBorrar" type="button" @click="confirmar = false">Cancelar</button>
      </div>
    </div>
    <p id="msgEditar" :class="['msg', msgEditar.clase]">{{ msgEditar.texto }}</p>
  </section>

  <p v-else id="pista" class="vacio">Elige una tarea en el panel de consulta para editarla.</p>

  <p class="marca">Vue 3 · Custom Element</p>
</template>

<style>
:host {
  --panel: #1b2735; --line: #2c3a4a; --txt: #e6edf3; --dim: #9fb3c8;
  --acc: #ff9900; --ok: #35c759; --err: #ff453a;
  display: block; color: var(--txt);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
h3 { margin: 0 0 10px; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--dim); }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin-bottom: 14px; }
label { display: block; font-size: 12.5px; color: var(--dim); margin-bottom: 5px; }
.tenue { opacity: .7; }
input[type=text] {
  width: 100%; padding: 9px 11px; border-radius: 7px; border: 1px solid var(--line);
  background: #0f1821; color: var(--txt); font: inherit;
}
input[type=text]:focus { outline: 2px solid var(--acc); outline-offset: 1px; border-color: transparent; }
.row { display: flex; gap: 9px; align-items: center; flex-wrap: wrap; margin-top: 11px; }
button {
  padding: 9px 15px; border-radius: 7px; border: 1px solid var(--line);
  background: #24303d; color: var(--txt); font: inherit; font-weight: 600; cursor: pointer;
}
button:hover:not(:disabled) { border-color: var(--acc); }
button:disabled { opacity: .5; cursor: not-allowed; }
button.main { background: var(--acc); border-color: var(--acc); color: #1a1200; }
button.danger { color: var(--err); border-color: #50303a; }
button.danger:hover:not(:disabled) { background: var(--err); color: #210b09; border-color: var(--err); }
.check { display: flex; gap: 8px; align-items: center; margin-top: 11px; font-size: 14px; color: var(--txt); }
.check input { width: 17px; height: 17px; accent-color: var(--acc); }
.msg { margin: 11px 0 0; font-size: 13.5px; min-height: 1.2em; }
.msg.ok { color: var(--ok); } .msg.err { color: var(--err); } .msg.info { color: var(--dim); }
.id { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11.5px; color: var(--dim); word-break: break-all; margin: 0 0 10px; }
.vacio { color: var(--dim); font-size: 14px; margin: 0; }
.confirm { border: 1px solid #50303a; background: #2a1a1e; border-radius: 8px; padding: 11px; margin-top: 11px; }
.confirm p { margin: 0; font-size: 13.5px; }
.marca { margin: 12px 0 0; font-size: 11px; color: var(--dim); opacity: .6; text-align: right; }
</style>
