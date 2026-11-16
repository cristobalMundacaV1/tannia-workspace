# TW-11 · 03 — Arquitectura de conocimiento y recuperación
## 1. Cuatro clases de fuente
| Clase | Contenido | Ejemplos | Confianza por defecto | Quién la incorpora |
|---|---|---|---|---|
| **A** Institucional/técnica | Normas, manuales, guías oficiales, especificaciones | Manuales de carreteras, normas NCh, guías de diseño de organismos públicos | `reported_by_source`, con versión y vigencia | Usuaria o Claude (investigación web) vía `registrar_fuente` con procedencia; **nunca automático** |
| **B** Académica | Apuntes, PPT, guías, pautas y rúbricas de Tannia | «Obras Civiles II» | Material didáctico: **no es norma** | Usuaria (carpeta `01 Antecedentes/Academico`) |
| **C** Proyecto | Planos, DXF, PDF, XLSX, memorias, versiones | Todo lo del proyecto | Dato del usuario; originales protegidos | Importación segura existente |
| **D** Métodos computables | Operaciones con contrato (doc 04) | área por secciones, CPM | Verificado por oráculos | Código del repositorio |

## 2. Contrato de fuente y pasaje
```jsonc
// tw.cic.source/1
{ "id":"src-…","class":"A|B|C|D","title":"…","publisher":"…","edition":"…","date":"…","version":"…",
  "origin":{"kind":"file|url|user_text","path_or_url":"…","retrieved_at":"…","retrieved_by":"user|claude_web|import"},
  "sha256":"…","license":{"status":"public|licensed|unknown","quote_limit_chars":300,"may_store_full_text":false},
  "binding":"binding|recommendation|informative|didactic|unknown",
  "supersedes":null,"valid_from":null,"valid_until":null,"disciplines":["…"],"language":"es" }
// tw.cic.passage/1
{ "id":"psg-…","source_id":"src-…","locator":{"page":12,"section":"3.2","heading_path":["3","3.2"],"sheet":null,"slide":null},
  "text_hash":"…","text":"(almacenado solo si license.may_store_full_text; si no, solo hash+offset+resumen propio)" }
```
Reglas: **`binding` nunca se infiere hacia arriba** (si la fuente no lo declara: `unknown`; una recomendación no se presenta como exigencia). Licenciada/desconocida: no se reproduce más de `quote_limit_chars` y se guarda *referencia + hash + resumen propio*, no el texto íntegro.

## 3. Respuesta técnica: cinco campos obligatorios
Toda respuesta técnica relevante producida con CIC separa (campo → `claim.kind`):
1. **Dato de fuente** (`data`) — con `source_refs` y localizador.
2. **Inferencia** (`inference`) — de qué claims deriva.
3. **Supuesto** (`assumption`) — editable, con quién lo propuso.
4. **Cálculo** (`calculation`) — con operación, versión, entradas.
5. **Pendiente de verificación** (`pending`) — qué evidencia o profesional lo cierra.
`tannia_cic_claims` devuelve en este formato; el prompt del servidor exige a Claude no mezclar categorías. Prueba: un verificador rechaza entregables donde un `pending` se renderiza sin la marca.

## 4. Búsqueda híbrida y recuperación contextual
- **Índice local** (`.tannia/indice/<disciplina>/`): BM25 sobre pasajes + facetas (clase, disciplina, vigencia, binding) + diccionario de sinónimos/siglas por disciplina (versionado, editable). Implementación propia en JS (sin servicios), determinista, reproducible.
- **Recuperación semántica (opcional, ADR aparte):** embeddings **locales** solo si el ADR prueba que se pueden empaquetar sin red/GPU y con tamaño aceptable; si no, **no** se incorpora. Mientras tanto, la «semántica» la aporta Claude reformulando consultas (multi-consulta) y el índice fusiona con RRF.
- **Contexto:** cada pasaje se indexa con su ruta de títulos (`heading_path`) y 1 pasaje vecino; la respuesta devuelve **pasaje + localizador**, no párrafos sueltos sin procedencia.
- **Índices por disciplina:** particionados para precisión y para poder actualizar uno sin reindexar todo.
- **Extractores:** PDF (texto con posiciones; reutiliza lector existente + extractor de texto), DOCX/PPTX/XLSX (ZIP/XML, sin dependencias nativas), MD/TXT. OCR: **fuera de alcance MVP** (declarado).
- **Actualización controlada:** una fuente nueva con `supersedes` marca la anterior `obsoleta` pero **no se borra**; los claims que dependían de ella quedan `stale` y `tannia_cic_verificar` los lista para revisión.
- **Red:** el servidor MCP **no** accede a Internet (política vigente, sin cambios). La investigación en web la hace Claude con sus herramientas; lo que use debe **entrar por `registrar_fuente`** (URL, fecha de acceso, extracto ≤ límite, `retrieved_by:"claude_web"`, `binding:"unknown"` salvo verificación). Lo no registrado no cuenta como evidencia en entregables. Ninguna fuente web es «de confianza automática»: la clase A requiere `publisher` reconocible y confirmación de la usuaria en modo profesional.
- **Sin norma inventada:** si la consulta no recupera pasaje, la respuesta es «no encontrado en las fuentes registradas» + dónde buscar; el código nunca completa valores normativos.

## 5. Métricas de recuperación (gate G3)
Conjunto dorado propio (documentos sintéticos redactados por el repositorio, sin material licenciado): recall@5 ≥ 0,85 y precisión de localizador (página/sección correcta) ≥ 0,95 sobre ≥ 60 consultas, de las cuales ≥ 20 *sin respuesta en el corpus* donde el sistema debe decir «no encontrado» (≥ 0,95). Conjunto **retenido** distinto del de desarrollo para medir sobreajuste.
