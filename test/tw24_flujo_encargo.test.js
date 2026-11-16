// TW09-08 (automatizable): el flujo del encargo final recorrido solo con herramientas del producto, como lo haría el agente, con
// continuidad entre sesiones (reinicio del servidor), proyecto ambiguo, entradas incompletas, rechazo geométrico y recuperación.
// NO sustituye la prueba en Claude Desktop real con la usuaria (pendiente).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { tmpHome, startClient, call, data } from './helpers.js';

test('«Crea un proyecto Casa Los Robles, aquí tienes los antecedentes, necesito una propuesta 3D y los planos guardados» — flujo completo y continuidad', async () => {
  const home = tmpHome('Tannia ñ flujo '); const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'flujo ñ ')); const antecedente = path.join(ext, 'Certificado de informaciones previas.pdf'); fs.writeFileSync(antecedente, '%PDF-1.7 antecedentes del terreno');
  let cli = await startClient(home); let c = cli.client;
  try {
    // 1) el agente evalúa el encargo y no encuentra el proyecto → lo crea (acción segura) sin preguntar
    let r = await call(c, 'tannia_encargo_evaluar', { solicitud: 'crea un proyecto Casa Los Robles, antecedentes adjuntos, propuesta 3D y planos para AutoCAD', antecedentes: { pdf: true }, pide: ['3d'], superficie_m2: 90, dormitorios: 3, banos: 2 }); assert.ok(!r.isError); const cap = data(r).capacidad; assert.ok(['anteproyecto_vivienda', 'trabajo_sobre_antecedentes'].includes(cap));
    r = await call(c, 'tannia_proyecto_resolver', { texto: 'Casa Los Robles' }); assert.equal(data(r).estado, 'ninguno');
    r = await call(c, 'tannia_proyecto_crear', { nombre: 'Casa Los Robles' }); assert.ok(!r.isError);
    // 2) antecedentes: el que tiene ruta se importa con hash; el "adjunto del chat" sin ruta se declara no importado (nunca se simula)
    r = await call(c, 'tannia_proyecto_importar', { proyecto: 'Casa Los Robles', archivos: [antecedente, 'plano-adjunto-en-el-chat.dwg'], nota: 'Certificado entregado por la usuaria' }); assert.deepEqual(data(r).resumen, { importados: 1, duplicados: 0, rechazados: 1 }); assert.match(JSON.stringify(data(r).resultados), /adjuntos del chat/);
    // 3) diseño 2D → inspección/previsualización → 3D desde el 2D con supuestos declarados
    r = await call(c, 'tannia_diseno_crear', { proyecto: 'Casa Los Robles', nombre: 'Casa Los Robles', solicitud: 'propuesta 3D', programa: { superficie_objetivo_m2: 90, dormitorios: 3, banos: 2 } }); assert.ok(!r.isError); assert.ok(data(r).preguntas_para_tannia.length);
    r = await call(c, 'tannia_diseno_previsualizar', { proyecto: 'Casa Los Robles', nombre: 'Casa Los Robles', operaciones: [{ operacion: 'ajustar_tamano', recinto: 'R-D2', eje: 'ancho', valor_mm: 90000 }] }); assert.equal(data(r).aplicable, false, 'rechazo geométrico explicado'); assert.equal(data(r).se_escribio_algo, false);
    r = await call(c, 'tannia_3d_crear', { proyecto: 'Casa Los Robles', nombre: 'Casa Los Robles 3D', desde_anteproyecto: { nombre: 'Casa Los Robles' } }); assert.ok(!r.isError); const d3 = data(r); assert.equal(d3.coherencia_2d.estado, 'coherente_en_alcance'); assert.ok(d3.supuestos_a_confirmar.length && /plano 2D/.test(d3.supuestos_a_confirmar[0]));
    // 4) sin AutoCAD el DWG no se inventa: error claro y el modelo queda guardado
    r = await call(c, 'tannia_3d_a_autocad', { proyecto: 'Casa Los Robles', nombre: 'Casa Los Robles 3D' }); assert.equal(r.isError, true); assert.match(JSON.stringify(r.content), /AUTOCAD_NO_DISPONIBLE|AUTOCAD_NO_ABIERTO|Windows/);
    assert.ok(!fs.existsSync(path.join(home, 'Proyectos', 'Casa Los Robles', '03 Trabajo', 'Modelos3D', 'Casa Los Robles 3D', 'v001_3D.dwg')));
    await cli.close();
    // 5) NUEVA SESIÓN (servidor reiniciado): "abre la casa de ayer" → se resuelve por nombre y el resumen permite continuar
    cli = await startClient(home); c = cli.client;
    r = await call(c, 'tannia_proyecto_resolver', { texto: 'la casa los robles' }); assert.equal(data(r).estado, 'unico'); const id = data(r).candidatos[0].id; assert.match(id, /^[0-9a-f-]{36}$/);
    r = await call(c, 'tannia_proyecto_resumen', { proyecto: 'Casa Los Robles' }); const res = data(r); assert.equal(res.id, id); assert.equal(res.anteproyectos.length, 1); assert.equal(res.modelos_3d.length, 1); assert.equal(res.antecedentes.importados, 1);
    assert.match(res.pendientes.join(' '), /DWG/); assert.match(res.pendientes.join(' '), /originales/);
    // 6) cambio conversacional ("sube la altura a 2,6 m") → versión nueva; el 3D avisa de la altura respecto del 2D; v001 sigue en disco
    r = await call(c, 'tannia_3d_modificar', { proyecto: 'Casa Los Robles', nombre: 'Casa Los Robles 3D', operaciones: [{ operacion: 'modificar_nivel', id: 'N1', cambios: { altura_mm: 2600 } }] }); assert.equal(data(r).version, 'v002'); assert.equal(data(r).coherencia_2d.estado, 'con_observaciones'); assert.equal(data(r).coherencia_2d.facetas.alturas.estado, 'revisar');
    assert.ok(fs.existsSync(path.join(home, 'Proyectos', 'Casa Los Robles', '03 Trabajo', 'Modelos3D', 'Casa Los Robles 3D', 'v001.json')));
    // 7) proyecto ambiguo: se pide aclarar, no se elige
    await call(c, 'tannia_proyecto_crear', { nombre: 'Casa Los Pinos' }); r = await call(c, 'tannia_proyecto_resolver', { texto: 'la casa los' }); assert.equal(data(r).estado, 'ambiguo'); assert.equal(data(r).candidatos.length, 2);
    // 8) entrada incompleta: faltan datos esenciales declarados; no soportado: se dice
    r = await call(c, 'tannia_encargo_evaluar', { solicitud: 'quiero un galpón con techo inclinado', tipo_edificacion: 'galpon' }); assert.ok(data(r).datos_esenciales_faltantes.some((f) => /Pendiente/.test(f)));
    r = await call(c, 'tannia_3d_crear', { proyecto: 'Casa Los Robles', nombre: 'Galpon', modelo: { niveles: [{ id: 'N1', cota_mm: 0, altura_mm: 3000 }], muros: [], cubiertas: [{ id: 'C', nivel: 'N1', tipo: 'un_agua', direccion: '+y' }] } }); assert.equal(r.isError, true); assert.match(JSON.stringify(r.content), /PENDIENTE_REQUERIDA|pendiente/i);
    // 9) originales: sin originales registrados el producto NO dice que la protección fue probada
    r = await call(c, 'tannia_originales_verificar', { proyecto: 'Casa Los Robles' }); assert.equal(data(r).proteccion_validada, false); assert.match(r.content[0].text, /NO prueba/);
  } finally { await cli.close(); fs.rmSync(home, { recursive: true, force: true }); fs.rmSync(ext, { recursive: true, force: true }); }
});
