# Shell · React 18

Aplicación anfitriona. Pinta el layout y monta los microfrontends; no tiene
lógica de negocio ni llama a la API de tareas.

## Cómo se integró React con el contrato

El shell **no conoce** el código de los microfrontends: solo sus URLs, que lee en
tiempo de ejecución de `registry.json`. React no renderiza `<todo-editor>` como
un componente propio; lo trata como un elemento DOM externo.

`src/MfeSlot.jsx`, dentro de un `useEffect`:

1. `import(/* @vite-ignore */ mfe.url)` — import dinámico de una URL que no existe
   al compilar. El comentario evita que Vite intente resolverla.
2. `customElements.whenDefined(mfe.tag)` con un tiempo máximo de 10 s, por si el
   módulo carga pero no registra la etiqueta.
3. `document.createElement(mfe.tag)` + `setAttribute('api-url', …)`: el único
   atributo del contrato.
4. Lo inserta en un `<div ref>` cuyo contenido React no gestiona.
5. En la limpieza del efecto quita el elemento, lo que dispara el
   `disconnectedCallback` del microfrontend.

## Resiliencia

Cada zona es un `MfeSlot` independiente con su propio `try/catch`. Si un
`import()` falla (red, CORS, MIME, módulo roto), el error se pinta **en esa zona**
y la otra sigue funcionando. Los textos de error se pintan como texto de React,
escapados.

## Configuración, sin URLs en el código

| Archivo | Contenido |
|---|---|
| `public/config.json` | `{ "apiUrl": "…/dev/todos" }` |
| `public/registry.json` | `{ "mfes": [ { name, tag, slot, url } ] }` |

Ambos se piden con `cache: 'no-store'` y CloudFront los sirve con `max-age=60` y
se invalidan al publicar.

## Versiones en el pie

Cada microfrontend exporta `version` desde su módulo. El shell la lee del resultado
del `import()` y la pinta en el pie. La versión del shell sale de su `package.json`.

## Compilar y publicar

```bash
npm install
npm run build          # dist/index.html + dist/assets/index-<hash>.js/css
npm run publicar       # bash ../infra/publicar.sh mfe-shell dist
```
