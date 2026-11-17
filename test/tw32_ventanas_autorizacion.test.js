// Ventanas de autorización (§6.7): pregunta natural y seis respuestas; lo técnico solo en «Detalles para auditoría».
import test from 'node:test';
import assert from 'node:assert/strict';
import { contenidoVentana } from '../src/autoridad/autorizacion.js';
import { CONSENT_WPF } from '../src/cic/consent.js';

const base = { pregunta: '¿Apruebas estos planos para su entrega?', porque: 'Los planos están listos.', revisar: ['Cotas de la sección'], autoriza: 'Entregar estos planos.', si_acepta: 'Se podrán exportar.', si_rechaza: 'No se entrega nada.', afecta: ['06 Informes/Planos/lamina-01.pdf'], tecnico: ['SHA-256 abcdef0123456789', 'Revisión r-123'] };

test('el contenido responde las seis preguntas y deja huellas e identificadores fuera del cuerpo principal', () => {
  const v = contenidoVentana(base);
  assert.equal(v.titulo, '¿Apruebas estos planos para su entrega?');
  for (const k of ['porque', 'revisar', 'autoriza', 'si_acepta', 'si_rechaza', 'afecta']) assert.ok(v[k], k);
  assert.doesNotMatch(v.texto_plano, /SHA|HMAC|r-123|snapshot|JSON/i);
  assert.match(v.tecnico, /SHA-256 abcdef/);
  for (const frag of ['Por qué ves esto', 'Qué autorizas', 'Si apruebas', 'Si no apruebas', 'Afecta a']) assert.ok(v.texto_plano.includes(frag), frag);
});

test('el título debe ser una pregunta concreta y no se admiten respuestas vacías', () => {
  assert.throws(() => contenidoVentana({ ...base, pregunta: 'Confirmación de estado de flujo — revisión R7' }), /pregunta/);
  for (const k of ['porque', 'autoriza', 'si_acepta', 'si_rechaza']) assert.throws(() => contenidoVentana({ ...base, [k]: '' }), new RegExp(k));
});

test('la plantilla WPF de pregunta expone cada sección a UI Automation, mantiene rechazo predeterminado y pliega lo técnico', () => {
  for (const id of ['txtTitulo', 'txtPorQue', 'txtResumen', 'txtAutoriza', 'txtSiAcepta', 'txtSiRechaza', 'txtAfecta', 'btnAutorizar', 'btnNoAutorizar', 'chkRevisado']) assert.ok(CONSENT_WPF.includes(`'${id}'`), id);
  assert.match(CONSENT_WPF, /Detalles para auditoría/);
  assert.match(CONSENT_WPF, /\$yes\.IsEnabled = \$false/, 'Autorizar empieza deshabilitado');
  assert.match(CONSENT_WPF, /\$no\.Focus\(\)/, 'el foco inicial está en «No»');
  assert.match(CONSENT_WPF, /'Escape'.*'cerrado'/, 'Esc cierra sin respuesta, no aprueba');
  assert.doesNotMatch(CONSENT_WPF, /XamlReader|Invoke-Expression|Start-Process/, 'los datos nunca se convierten en XAML ni en comandos');
});
