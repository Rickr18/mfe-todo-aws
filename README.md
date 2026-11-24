# Aplicación TODO con microfrontends en AWS

**Sistemas Distribuidos · Actividad Microfrontends**
Docente: Omar Marenco Caneppa · Integrantes: **Rick Ríos** y **Andrés Zambrano**

La interfaz de la API TODO (Parte 2) está dividida en **tres piezas independientes**.
Cada una usa un framework distinto, se compila por separado y se publica en
**su propia cuenta AWS**, detrás de **su propia distribución CloudFront** con bucket S3 privado y OAC.

> El grupo es de dos integrantes con aprobación del docente. Andrés usó **dos cuentas
> AWS propias**, así que las tres piezas quedaron en **tres cuentas distintas**.

📄 **Informe (2 páginas): [`INFORME.pdf`](INFORME.pdf)**

---

## 1. URLs públicas

| Pieza | Tecnología | URL | Cuenta AWS | Región del bucket |
|---|---|---|---|---|
| **Shell** | React 18 | https://dxeyfn41lmx4j.cloudfront.net | 4023-4969-3538 (Rick) | us-east-1 |
| **MFE Editor** `<todo-editor>` | Vue 3 | https://d26iej8afagt5w.cloudfront.net/todo-editor.js | 4483-6270-4413 (Andrés) | us-east-1 |
| **MFE Viewer** `<todo-viewer>` | Lit 3 | https://d1migev8duylqq.cloudfront.net/todo-viewer.js | 7569-7413-6125 (Andrés) | us-east-2 |
| **API** | API Gateway + Lambda + DynamoDB + SNS/SQS | https://l1appem2n5.execute-api.us-east-1.amazonaws.com/dev/todos | 4023-4969-3538 (Rick) | us-east-1 |

**Abrir la aplicación:** https://dxeyfn41lmx4j.cloudfront.net

## 2. Reparto del trabajo

| Integrante | Responsable de | Cuenta(s) |
|---|---|---|
| **Rick Ríos** | Shell en React, API con CORS, integración (`config.json` y `registry.json`), plantillas de infraestructura, pruebas y documentación | 1 |
| **Andrés Zambrano** | MFE Editor en Vue 3 y MFE Viewer en Lit 3: crear sus distribuciones, publicarlos y restringir CORS al shell | 2 |

## 3. Arquitectura

```
                          Navegador (todo por HTTPS)
                                     │
      ① https://dxeyfn41lmx4j.cloudfront.net  → index.html, config.json, registry.json
                                     │                                  [Cuenta 1 · Shell React]
              ┌──────────────────────┴──────────────────────┐
              │ ② import() dinámico                          │ ② import() dinámico
              ▼                                              ▼
  d26iej8afagt5w.cloudfront.net                   d1migev8duylqq.cloudfront.net
  /todo-editor.js → assets/…-hash.js              /todo-viewer.js → assets/…-hash.js
  [Cuenta 2 · Vue 3]                              [Cuenta 3 · Lit 3]
              │                                              │
      ┌───────┴────────┐   CustomEvents en window   ┌────────┴───────┐
      │  <todo-editor> │ ◄────────────────────────► │  <todo-viewer> │
      └───────┬────────┘  created/updated/deleted/  └────────┬───────┘
              │                 selected                     │
              │ ③ POST / PUT / DELETE                        │ ③ GET lista, detalle, historial
              └──────────────────────┬───────────────────────┘
                                     ▼
        API Gateway (CORS) → Lambda → DynamoDB → SNS → SQS (auditoría, notificaciones, DLQ)

  En cada cuenta:  CloudFront ──OAC (SigV4)──► bucket S3 PRIVADO (acceso público bloqueado)
```

**Contrato entre piezas:** Custom Elements con Shadow DOM, un único atributo de entrada
(`api-url`, que inyecta el shell desde `config.json`) y eventos en `window`
(`todo:created`, `todo:updated`, `todo:deleted`, `todo:selected`).
Ningún microfrontend importa código de otro.

## 4. Código fuente

| Carpeta | Contenido |
|---|---|
| [`shell/`](shell/) | React 18 + Vite. Lee `registry.json`, importa cada MFE desde su URL y lo monta. Si uno falla, solo su zona muestra el aviso |
| [`mfe-editor/`](mfe-editor/) | Vue 3 con `defineCustomElement` → `<todo-editor>` (crear, editar, completar, eliminar) |
| [`mfe-viewer/`](mfe-viewer/) | Lit 3 `LitElement` → `<todo-viewer>` (lista, detalle e historial de eventos) |
| [`api/`](api/) | Plantilla SAM de la Parte 2 con `Cors` en `AWS::Serverless::Api` |
| [`infra/`](infra/) | `sitio.yaml` (CloudFormation: bucket privado + OAC + política CORS + distribución), `crear-sitio.sh` y `publicar.sh` |
| [`tools/`](tools/) | `dev.js` (las 3 piezas en 3 orígenes locales + API simulada) y `e2e.js` (22 comprobaciones con Playwright) |

Cada carpeta tiene su propio `README.md` con las instrucciones de despliegue.

## 5. Estrategia de caché y despliegue independiente

Cada microfrontend publica dos archivos:

| Archivo | Ejemplo | `Cache-Control` | Al publicar |
|---|---|---|---|
| Bundle con hash | `assets/todo-viewer-CPa3clae.js` | `public, max-age=31536000, immutable` | Nunca se invalida: si cambia el código, cambia el nombre |
| Entrada estable | `todo-viewer.js` (1 línea que reexporta el bundle) | `public, max-age=60` | Invalidación solo de esta ruta |
| `index.html`, `config.json`, `registry.json` (shell) | — | `public, max-age=60` | Invalidación solo de estas rutas |

Gracias a esto, publicar una versión nueva de un microfrontend **no obliga a tocar el
shell ni el `registry.json`**: el shell sigue apuntando a la entrada estable, que ahora
reexporta el bundle nuevo. `infra/publicar.sh` aplica las cabeceras e invalida solo lo necesario.

---

## 6. Evidencias

### 6.1 Carga independiente desde tres orígenes (DevTools → Network)

Columna **Domain**: el shell (`dxeyfn41lmx4j`), el editor (`d26iej8afagt5w`), el viewer
(`d1migev8duylqq`) y la API (`l1appem2n5.execute-api`). Los bundles llegan con hash y la
consola no muestra errores. A la izquierda se ve el flujo funcionando: tarea completada
con su historial `todo.created` → `todo.completed`.

![Network con tres orígenes](evidencias/1-shell-api/06-network-3-origenes.jpg)

### 6.2 Resiliencia: un microfrontend caído no tumba la página

Con el bundle del editor bloqueado (*Request conditions → Block*), solo la zona del
editor muestra el aviso. El viewer sigue cargando y consumiendo la API.

![Editor bloqueado, viewer funcionando](evidencias/1-shell-api/08-resiliencia-editor-caido.jpg)

### 6.3 Cuentas distintas (S3 con ID de cuenta visible)

| Shell · cuenta 4023-4969-3538 | Editor · cuenta 4483-6270-4413 | Viewer · cuenta 7569-7413-6125 |
|---|---|---|
| ![](evidencias/1-shell-api/01-bucket-cuenta.jpg) | ![](evidencias/2-editor/01-bucket-cuenta.jpg) | ![](evidencias/3-viewer/01-bucket-cuenta.jpg) |

En la captura del viewer, el ID de cuenta aparece en la barra de direcciones (`756974136125-…console.aws.amazon.com`).

### 6.4 Buckets privados (acceso público bloqueado)

| Shell | Editor | Viewer |
|---|---|---|
| ![](evidencias/1-shell-api/02-acceso-bloqueado.jpg) | ![](evidencias/2-editor/02-acceso-bloqueado.jpg) | ![](evidencias/3-viewer/02-acceso-bloqueado-y-politica.jpg) |

### 6.5 Política del bucket: solo CloudFront de esa distribución (OAC + `AWS:SourceArn`)

| Shell | Editor | Viewer |
|---|---|---|
| ![](evidencias/1-shell-api/03-politica-bucket.jpg) | ![](evidencias/2-editor/03-politica-bucket.jpg) | ![](evidencias/3-viewer/02-acceso-bloqueado-y-politica.jpg) |

### 6.6 Distribuciones CloudFront (estado *Enabled*)

| Shell `E2PDT6NKJZU4KC` | Editor `E3PN6OCP33Y5X3` | Viewer `E3IHET7KUU8LGG` |
|---|---|---|
| ![](evidencias/1-shell-api/04-distribucion.jpg) | ![](evidencias/2-editor/04-distribucion.jpg) | ![](evidencias/3-viewer/04-distribucion.jpg) |

### 6.7 Origin Access Control (OAC)

| Shell | Editor | Viewer |
|---|---|---|
| ![](evidencias/1-shell-api/05-oac.jpg) | ![](evidencias/2-editor/05-oac.jpg) | ![](evidencias/3-viewer/05-oac.jpg) |

### 6.8 CORS de los microfrontends restringido al dominio del shell

Política de cabeceras de respuesta `mfe-editor-cors` (Access-Control-Allow-Origin = `https://dxeyfn41lmx4j.cloudfront.net`):

![CORS editor](evidencias/2-editor/06-cors.jpg)

Comprobación con `curl` de las dos entradas estables: `HTTP/2 200`, `text/javascript`,
`max-age=60` y `access-control-allow-origin` igual al dominio del shell.

| Editor | Viewer (creación del sitio, publicación y `curl`) |
|---|---|
| ![](evidencias/2-editor/07-curl.jpg) | ![](evidencias/3-viewer/07-publicar-y-curl.jpg) |

Creación del sitio del viewer con la plantilla compartida (`infra/crear-sitio.sh`):

![Crear sitio viewer](evidencias/3-viewer/06-crear-sitio.jpg)

### 6.9 API con preflight CORS

`sam deploy` del stack `todo-api` y `curl -X OPTIONS` → `HTTP/2 200` con `access-control-allow-origin`.

![API y preflight](evidencias/1-shell-api/07-api-cors-preflight.jpg)

### 6.10 Demostración de versión nueva (viewer 1.0.0 → 1.1.0)

**Antes**, en AWS: el pie del shell muestra `shell 1.0.0 · todo-viewer 1.0.0 · todo-editor 1.0.0`.

![Versión 1.0.0](evidencias/3-viewer/08-version-antes-1.0.0.jpg)

**Después:** el viewer pasa a 1.1.0 con `npm version 1.1.0`, `npm run build` y
`npm run publicar` en la cuenta del viewer, sin tocar el shell, su `registry.json`
ni el editor. El build genera un bundle con hash nuevo y solo se invalida `/todo-viewer.js`.

> **Nota:** la publicación de la 1.1.0 en AWS quedó pendiente porque el integrante
> dueño de la cuenta del viewer se quedó sin energía eléctrica antes del cierre de la
> entrega. La captura siguiente es la **reproducción local** del mismo proceso, hecha con
> `tools/dev.js`, que sirve cada pieza en un origen distinto. Se ve el pie con
> `todo-viewer 1.1.0` mientras el shell y el editor siguen en `1.0.0`. La demostración
> en AWS se puede hacer en vivo con los mismos tres comandos.

![Versión 1.1.0 (reproducción local)](evidencias/3-viewer/09-version-1.1.0-local.jpg)

---

## 7. Cómo desplegar

En AWS CloudShell de cada cuenta:

```bash
# 1. Crear el sitio (bucket privado + OAC + CORS + CloudFront)
bash infra/crear-sitio.sh mfe-editor <sufijo> https://<dominio-del-shell>.cloudfront.net

# 2. Publicar con las cabeceras de caché correctas
bash infra/publicar.sh mfe-editor mfe-editor/dist
```

La API se despliega con `sam build && sam deploy --guided` en `api/`. El shell se publica
después de poner las URLs reales en `shell/public/config.json` y `shell/public/registry.json`.
Para probar en local: `node tools/dev.js` y `node tools/e2e.js`.
