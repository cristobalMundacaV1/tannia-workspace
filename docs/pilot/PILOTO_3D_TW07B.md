# TW-07B — Piloto 3D con Tannia (protocolo preparado, NO ejecutado)

**Estado: PENDIENTE (requiere AutoCAD real + Tannia).** Prerrequisito: pruebas C y D de `docs/qa/MANUAL_TESTS_TANNIA_PC.md`.

## Material de referencia 3D (crearlo en AutoCAD; valores analíticos conocidos)
Caja sólida 2×3×4 (V=24, A=52) · cilindro r=1, h=2 (V=2π≈6.2832) · prisma triangular · malla cerrada equivalente · malla abierta · superficie plana · un objeto con **escala no uniforme** en un bloque.

## Trabajos
1. «¿Qué elementos 3D tiene este dibujo?» → lista por tipo; **debe informar los tipos no soportados**, no ignorarlos.
2. «Dame volumen y área de estos sólidos» → coincide con el valor de AutoCAD; si el tipo no está SUPPORTED, lo dice.
3. «Pásame esos volúmenes a una partida de hormigón» → Claude **pregunta** a qué elemento corresponde (un sólido no implica material); no asigna por sí solo.
4. «Agrega una línea de eje en la copia» → solo en `03 Trabajo`; original intacto.

## Criterios
Valores iguales a AutoCAD (tol. 1e-6 rel.) · tipos desconocidos reportados · cero volúmenes inventados · ediciones solo en copias · matriz `CAD_CAPABILITY_MATRIX` actualizada con la evidencia real. Hasta entonces: **PILOTO 3D NO EJECUTADO**.
