/**
 * Genera dist/<nombre>.js: la URL ESTABLE que va en el registry.json del shell.
 *
 * Es un archivo de una línea que reexporta el bundle real, cuyo nombre lleva
 * hash (assets/<nombre>-a1b2c3.js). Así:
 *   - el bundle con hash se cachea un año: nunca cambia
 *   - la entrada estable se cachea 60 s y se invalida al publicar
 *   - publicar una versión nueva NO obliga a tocar el registry del shell
 */
import { readdirSync, writeFileSync } from 'node:fs';

const nombre = process.argv[2];
const bundles = readdirSync('dist/assets').filter(
  (f) => f.startsWith(`${nombre}-`) && f.endsWith('.js'),
);
if (bundles.length !== 1) {
  console.error(`Esperaba 1 bundle ${nombre}-*.js en dist/assets y hay ${bundles.length}`);
  process.exit(1);
}
writeFileSync(
  `dist/${nombre}.js`,
  `export { version } from './assets/${bundles[0]}';\n`,
);
console.log(`dist/${nombre}.js -> assets/${bundles[0]}`);
