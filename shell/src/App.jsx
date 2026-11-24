import { useCallback, useEffect, useState } from 'react';
import MfeSlot from './MfeSlot.jsx';

/**
 * Shell: layout + montaje. Sin lógica de negocio y sin llamadas a la API
 * de tareas. Todas las URLs vienen de config.json y registry.json.
 */
const ZONAS = [
  { slot: 'slot-editor', titulo: 'Editor' },
  { slot: 'slot-viewer', titulo: 'Consulta' },
];

async function leerJson(ruta) {
  const r = await fetch(ruta, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${ruta} respondió HTTP ${r.status}`);
  return r.json();
}

export default function App() {
  const [conf, setConf] = useState({ estado: 'cargando' });
  const [versiones, setVersiones] = useState({});

  useEffect(() => {
    Promise.all([leerJson('./config.json'), leerJson('./registry.json')])
      .then(([config, registry]) => {
        const apiUrl = String(config.apiUrl || '').replace(/\/+$/, '');
        if (!apiUrl) throw new Error('Falta "apiUrl" en config.json');
        setConf({ estado: 'ok', apiUrl, mfes: registry.mfes || [] });
      })
      .catch((err) => setConf({ estado: 'error', detalle: err.message }));
  }, []);

  const anotarVersion = useCallback(
    (nombre, v) => setVersiones((prev) => ({ ...prev, [nombre]: v })),
    [],
  );

  return (
    <>
      <header>
        <h1>Aplicación TODO</h1>
        <span>Shell en React · microfrontends independientes</span>
      </header>

      <main>
        {ZONAS.map(({ slot, titulo }) => {
          const mfe = conf.estado === 'ok' && conf.mfes.find((m) => m.slot === slot);
          return (
            <section className="zone" key={slot}>
              <h2>{titulo}</h2>
              {conf.estado === 'cargando' && <p className="status">Leyendo configuración…</p>}
              {conf.estado === 'error' && (
                <p className="status bad">
                  No se pudo leer la configuración del shell.
                  <code>{conf.detalle}</code>
                </p>
              )}
              {conf.estado === 'ok' && !mfe && (
                <p className="status bad">
                  Ningún microfrontend registrado para esta zona.
                  <code>{slot}</code>
                </p>
              )}
              {mfe && <MfeSlot mfe={mfe} apiUrl={conf.apiUrl} onVersion={anotarVersion} />}
            </section>
          );
        })}
      </main>

      <footer id="versions">
        <span>shell <b>{__VERSION__}</b></span>
        {Object.entries(versiones).map(([n, v]) => (
          <span key={n}>{n} <b>{v}</b></span>
        ))}
      </footer>
    </>
  );
}
