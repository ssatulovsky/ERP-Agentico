# 4.2 Evaluación de los agentes con un LLM real

Banco de 240 consultas (20 por cada uno de los 12 agentes) sobre una empresa de evaluación con datos conocidos de todos los módulos. Por cada consulta se mide:

- **Herramienta correcta.** En los casos `HERRAMIENTA`, el agente llamó la herramienta esperada. En los casos `PIDE_DATOS`, pidió los datos que faltan y no ejecutó ni propuso nada. En los casos `FUERA_DE_ALCANCE`, dijo que la tarea es de otro agente y nombró cuál.
- **Dictamen coincide.** Cada monto que cita la respuesta aparece en la consulta o en lo que entregaron las herramientas (tolerancia de $1). Un monto sin origen cuenta como inventado.

Un caso se aprueba con ambos criterios. El umbral del plan es 90 % de aciertos (variable `EVAL_UMBRAL`).

## Cómo ejecutarla

```bash
# Las 240 consultas con el modelo configurado en el ERP
GEMINI_API_KEY=... npm run eval:llm

# Un agente, o los primeros N casos de cada agente
GEMINI_API_KEY=... npm run eval:llm -- --modulo RRHH
GEMINI_API_KEY=... npm run eval:llm -- --limite 5

# Sin modelo: valida datos, casos y criterios (corre dentro de npm test)
npm run eval:llm -- --autoprueba
```

El informe queda en `evals/llm/resultados/llm-<fecha>.md` (y `.json` con cada caso). Incluye el acierto por agente, los casos reprobados con su motivo y el consumo de la corrida (llamadas, tokens y gasto estimado). La corrida termina con código 1 si el acierto queda bajo el umbral.

La empresa de evaluación se crea con un identificador nuevo en cada corrida y no tiene tope diario de tokens ni de gasto (3.5), para que la corrida no se corte a la mitad. El tope de llamadas por ejecución sigue vigente. Con `--conservar` la empresa queda registrada para revisar sus datos y las aprobaciones que propusieron los agentes.

## Autoprueba

`--autoprueba` corre los 240 casos con dos modelos simulados:

- Un **oráculo** que hace lo correcto en cada caso. Debe obtener 100 %, y además la herramienta esperada debe encontrar los datos de prueba (si responde `NO_DATA` o `MISSING_PARAMS`, el caso está mal armado).
- Un modelo que **inventa** un resultado ("$4.247.668, quedó registrado") en todos los casos. Debe obtener 5 % o menos.

Así, un resultado bajo con el LLM real se puede atribuir al modelo o al motor, no al banco de casos.

## Archivos

| Archivo | Contenido |
| --- | --- |
| `fixtures.ts` | Empresa de evaluación: banco, asientos, RCV, activos fijos, inventario, producción, rendición, nómina y una solicitud de cotización con dos ofertas |
| `cases.ts` | Las 240 consultas, con la herramienta y los argumentos que usaría un agente ideal |
| `scoring.ts` | Criterios de aprobación |
| `run.ts` | Ejecución, informe y autoprueba |
