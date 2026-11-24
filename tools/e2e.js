/**
 * Prueba de extremo a extremo: shell (React) + editor (Vue) + viewer (Lit),
 * compilados y servidos desde tres orígenes distintos contra la API simulada.
 *
 *   node tools/dev.js        (en otra terminal)
 *   node tools/e2e.js        (requiere: npm i -g playwright  o  npx playwright)
 */
const { chromium } = require('playwright');

const SHELL = process.env.SHELL_URL || 'http://localhost:4003/';
let fallos = 0;
const check = (c, t) => { console.log(`${c ? '  OK  ' : ' FALLA'} ${t}`); if (!c) fallos++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', (e) => errores.push(String(e)));

  const peticiones = [];
  page.on('request', (r) => peticiones.push(r.url()));

  console.log('\n— Carga del shell —');
  await page.goto(SHELL, { waitUntil: 'networkidle' });
  await page.waitForSelector('todo-editor');
  await page.waitForSelector('todo-viewer');

  check(await page.locator('todo-editor').count() === 1, 'el shell (React) montó <todo-editor>');
  check(await page.locator('todo-viewer').count() === 1, 'el shell (React) montó <todo-viewer>');
  const api = await page.locator('todo-editor').getAttribute('api-url');
  check(/\/todos$/.test(api || ''), `api-url inyectado desde config.json (${api})`);

  const marcaE = await page.locator('todo-editor .marca').innerText();
  const marcaV = await page.locator('todo-viewer .marca').innerText();
  check(/Vue/.test(marcaE), `el editor es Vue (${marcaE})`);
  check(/Lit/.test(marcaV), `el viewer es Lit (${marcaV})`);

  await page.waitForFunction(() => document.getElementById('versions').innerText.split('\n').length >= 3
    || document.getElementById('versions').querySelectorAll('span').length >= 3);
  const pie = (await page.locator('#versions').innerText()).replace(/\n/g, ' · ');
  check(/todo-editor/.test(pie) && /todo-viewer/.test(pie), `el pie muestra las versiones (${pie})`);

  console.log('\n— Flujo CRUD —');
  // La API puede tener tareas previas: se trabaja con conteos relativos
  // y con títulos únicos de esta ejecución.
  await page.waitForFunction(() =>
    !document.querySelector('todo-viewer').shadowRoot.querySelector('#lista').innerText.includes('Cargando'));
  const n0 = await page.locator('todo-viewer li').count();
  const tag = Date.now().toString(36);
  const T1 = `Preparar la demo ${tag}`;
  const T1b = `Preparar la demo ${tag} (revisado)`;

  const nuevo = page.locator('todo-editor #nuevo');
  await nuevo.fill(T1);
  await page.locator('todo-editor #crear').click();
  await page.waitForFunction((n) =>
    document.querySelector('todo-viewer').shadowRoot.querySelectorAll('li').length === n, n0 + 1);
  check(true, 'POST /todos y el viewer se refrescó solo con todo:created');

  await nuevo.fill(`Segunda tarea ${tag}`);
  await page.locator('todo-editor #crear').click();
  await page.waitForFunction((n) =>
    document.querySelector('todo-viewer').shadowRoot.querySelectorAll('li').length === n, n0 + 2);
  check(true, 'segunda tarea creada (lista por GET /todos)');

  console.log('\n— Selección y edición —');
  await page.locator('todo-viewer li', { hasText: T1 }).click();
  await page.waitForSelector('todo-viewer .detalle table');
  check(await page.locator('todo-editor #panel').isVisible(),
        'todo:selected abrió el panel de edición en el editor');
  const filas = await page.locator('todo-viewer .detalle table tr').count();
  check(filas >= 1, `GET /history pintó ${filas} evento(s)`);

  await page.locator('todo-editor #titulo').fill(T1b);
  await page.locator('todo-editor #hecha').check();
  await page.locator('todo-editor #guardar').click();
  await page.waitForFunction((t) =>
    [...document.querySelector('todo-viewer').shadowRoot.querySelectorAll('li.done .tit')]
      .some((el) => el.textContent === t), T1b);
  check(true, 'PUT /todos/{id} y el viewer reflejó todo:updated');
  const texto = await page.locator('todo-viewer li.done', { hasText: T1b }).locator('.tit').innerText();
  check(texto === T1b, `título actualizado y completada en la lista (${texto})`);

  console.log('\n— Historial y borrado —');
  await page.locator('todo-viewer li.done', { hasText: T1b }).click();
  await page.waitForFunction(() => {
    const t = document.querySelector('todo-viewer').shadowRoot.querySelector('.detalle table');
    return t && t.querySelectorAll('tr').length >= 2;
  });
  const tipos = await page.locator('todo-viewer .detalle table tr td:first-child').allInnerTexts();
  check(tipos.includes('todo.created') && tipos.includes('todo.completed'),
        `historial con los eventos (${tipos.join(', ')})`);

  await page.locator('todo-editor #borrar').click();
  check(await page.locator('todo-editor #confirm').isVisible(), 'el borrado pide confirmación');
  await page.locator('todo-editor #siBorrar').click();
  await page.waitForFunction((n) =>
    document.querySelector('todo-viewer').shadowRoot.querySelectorAll('li').length === n, n0 + 1);
  check(true, 'DELETE /todos/{id} y el viewer reflejó todo:deleted');

  console.log('\n— Validación —');
  await nuevo.fill('   ');
  await page.locator('todo-editor #crear').click();
  const msg = await page.locator('todo-editor #msgCrear').innerText();
  check(/vac/i.test(msg), `rechaza el título vacío sin llamar a la API (${msg})`);

  console.log('\n— Orígenes, compilación y consola —');
  const origenes = new Set(peticiones.map((u) => new URL(u).origin));
  const tres = ['4001', '4002', '4003'].every((p) => [...origenes].some((o) => o.endsWith(p)));
  check(tres, `cargado desde 3 orígenes distintos + la API (${origenes.size} orígenes)`);
  const conHash = peticiones.filter((u) => /assets\/todo-(editor|viewer)-[\w-]{6,}\.js$/.test(u));
  check(conHash.length === 2, `los MFE se sirven compilados con hash (${conHash.map((u) => u.split('/').pop()).join(', ')})`);
  check(errores.length === 0, errores.length ? `consola limpia (${errores[0]})` : 'consola sin errores');

  console.log('\n— Resiliencia: un microfrontend caído —');
  await page.route('**/todo-editor.js', (r) => r.abort());
  await page.goto(SHELL, { waitUntil: 'networkidle' });
  await page.waitForSelector('todo-viewer');
  check(await page.locator('todo-viewer').count() === 1, 'con el editor caído, el viewer sigue montado');
  await page.waitForSelector('#slot-editor .status.bad');
  check(true, 'el shell muestra el aviso solo en la zona del editor');
  await page.waitForFunction(() =>
    document.querySelector('todo-viewer').shadowRoot.querySelectorAll('li').length >= 1);
  check(true, 'el viewer sigue consumiendo la API');
  await page.screenshot({ path: 'tools/captura-mfe-caido.png', fullPage: true });

  await page.unroute('**/todo-editor.js');
  await page.goto(SHELL, { waitUntil: 'networkidle' });
  await page.waitForSelector('todo-editor');
  await page.screenshot({ path: 'tools/captura-ok.png', fullPage: true });

  await browser.close();
  console.log(`\n${fallos === 0 ? 'TODO CORRECTO' : fallos + ' FALLO(S)'}\n`);
  process.exit(fallos ? 1 : 0);
})();
