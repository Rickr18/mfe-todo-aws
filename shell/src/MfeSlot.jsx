import { useEffect, useRef, useState } from 'react';

const ESPERA_MS = 10000;

/**
 * Carga un microfrontend en tiempo de ejecución y lo monta en su zona.
 *
 * 1. import() dinámico de la URL declarada en registry.json (otro origen)
 * 2. espera a que el módulo registre su Custom Element
 * 3. crea la etiqueta, le pasa api-url y la inserta
 *
 * Si algo falla, el error queda dentro de ESTA zona: el resto de la página
 * y el otro microfrontend siguen funcionando.
 */
export default function MfeSlot({ mfe, apiUrl, onVersion }) {
  const host = useRef(null);
  const [estado, setEstado] = useState({ tipo: 'cargando' });

  useEffect(() => {
    let vivo = true;
    let elemento = null;

    (async () => {
      try {
        // @vite-ignore: la URL no se conoce al compilar, viene del registro
        const modulo = await import(/* @vite-ignore */ mfe.url);

        await Promise.race([
          customElements.whenDefined(mfe.tag),
          new Promise((_, no) =>
            setTimeout(() => no(new Error(`el módulo no registró <${mfe.tag}>`)), ESPERA_MS)),
        ]);
        if (!vivo) return;

        elemento = document.createElement(mfe.tag);
        elemento.setAttribute('api-url', apiUrl);   // único atributo del contrato
        host.current.replaceChildren(elemento);

        setEstado({ tipo: 'ok' });
        onVersion(mfe.name, modulo.version ?? 'sin versión');
      } catch (err) {
        if (!vivo) return;
        console.error(`[shell] no se pudo cargar ${mfe.name}:`, err);
        setEstado({ tipo: 'error', detalle: `${err.message} — ${mfe.url}` });
        onVersion(mfe.name, 'no disponible');
      }
    })();

    return () => {
      vivo = false;
      elemento?.remove();   // dispara disconnectedCallback en el MFE
    };
  }, [mfe.url, mfe.tag, mfe.name, apiUrl, onVersion]);

  return (
    <div id={mfe.slot}>
      {estado.tipo === 'cargando' && <p className="status">Cargando microfrontend…</p>}
      {estado.tipo === 'error' && (
        <p className="status bad">
          No se pudo cargar «{mfe.name}». El resto sigue funcionando.
          <code>{estado.detalle}</code>
        </p>
      )}
      <div ref={host} />
    </div>
  );
}
