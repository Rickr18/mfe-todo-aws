# MFE Editor · Vue 3 · `<todo-editor>`

Pieza de escritura.

| Acción | Llamada | Emite |
|---|---|---|
| Crear tarea | `POST /todos` | `todo:created` |
| Editar título / completar | `PUT /todos/{id}` | `todo:updated` |
| Eliminar (con confirmación) | `DELETE /todos/{id}` | `todo:deleted` |

Escucha `todo:selected` para abrir el panel de edición.

## Cómo se integró Vue con el contrato

Vue trae `defineCustomElement`, que convierte un componente en una clase que
extiende `HTMLElement`. `src/main.js`:

```js
const TodoEditorElement = defineCustomElement(TodoEditor);
if (!customElements.get('todo-editor')) {
  customElements.define('todo-editor', TodoEditorElement);
}
export const version = __VERSION__;
```

| Exigencia del contrato | Cómo se cumple en Vue |
|---|---|
| Atributo `api-url` | Vue convierte el atributo kebab-case en la prop `apiUrl` (`defineProps`) |
| Shadow DOM | `defineCustomElement` monta el componente en un shadow root abierto |
| Estilos aislados | El archivo se llama `TodoEditor.ce.vue`; con la opción `customElement` del plugin, su `<style>` se compila **dentro** del shadow root, no al `<head>` |
| Limpieza de oyentes | Vue desmonta la app cuando el elemento sale del DOM, así que `onUnmounted` hace el `removeEventListener` |
| `textContent`, no `innerHTML` | Todo el texto va con `{{ }}`, que Vue escapa. No se usa `v-html` |
| Doble importación | `if (!customElements.get(…))` |

Vue va **dentro** del bundle (no como dependencia externa): el shell no comparte
librerías con los microfrontends, así que cada pieza es autosuficiente.

## Por qué hay dos archivos en `dist/`

```
dist/todo-editor.js                  export { version } from './assets/todo-editor-<hash>.js'
dist/assets/todo-editor-<hash>.js    el bundle real (Vue + componente)
```

El shell siempre importa la URL estable `/todo-editor.js`. Esa línea reexporta el
bundle con hash. Así el bundle se cachea un año, y publicar una versión nueva
solo exige invalidar `/todo-editor.js`: el `registry.json` del shell no cambia.
Lo genera `scripts/entrada-estable.mjs` después de `vite build`.

## Compilar y publicar

```bash
npm install
npm run build          # vite build (modo librería) + entrada estable
npm run publicar       # bash ../infra/publicar.sh mfe-editor dist
```
