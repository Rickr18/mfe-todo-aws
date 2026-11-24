# MFE Viewer · Lit 3 · `<todo-viewer>`

Pieza de lectura.

| Acción | Llamada |
|---|---|
| Listar tareas (cargando, vacío, error) | `GET /todos` |
| Ver detalle | `GET /todos/{id}` |
| Ver historial de eventos | `GET /todos/{id}/history` |

Emite `todo:selected` al elegir una tarea. Escucha `todo:created`,
`todo:updated` y `todo:deleted` para refrescarse solo.

## Cómo se integró Lit con el contrato

Lit está hecho para Web Components: `LitElement` **extiende `HTMLElement`**, así que
el componente ya es un Custom Element y no necesita adaptador.

| Exigencia del contrato | Cómo se cumple en Lit |
|---|---|
| Atributo `api-url` | `static properties = { apiUrl: { type: String, attribute: 'api-url' } }` |
| Cargar al recibir la URL | `willUpdate(cambios)` carga la lista cuando llega o cambia `apiUrl` |
| Shadow DOM | Lit renderiza en un shadow root abierto por defecto |
| Estilos aislados | `static styles = css\`…\``, adoptados en el shadow root |
| Limpieza de oyentes | `connectedCallback` / `disconnectedCallback` (llamando a `super`) añaden y quitan los oyentes de `window` |
| `textContent`, no `innerHTML` | Las plantillas `html\`\`` insertan los valores como nodos de texto. No se usa `unsafeHTML` |
| Doble importación | `if (!customElements.get(…))` |

## `todo:selected`

Se emite con `{ id, title, completed }`. El contrato solo exige `id`; los otros dos
son una comodidad para que el editor pinte su panel sin hacer otra llamada.

## Por qué hay dos archivos en `dist/`

```
dist/todo-viewer.js                  export { version } from './assets/todo-viewer-<hash>.js'
dist/assets/todo-viewer-<hash>.js    el bundle real (Lit + componente)
```

El shell importa siempre `/todo-viewer.js` (caché 60 s + invalidación); esa línea
reexporta el bundle con hash (caché un año). Publicar una versión nueva no toca el
`registry.json` del shell. Esta es la pieza que hace la demostración de versión nueva.

## Compilar y publicar

```bash
npm install
npm run build          # vite build (modo librería) + entrada estable
npm run publicar       # bash ../infra/publicar.sh mfe-viewer dist
```
