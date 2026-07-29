# Documentacion de klaUS-aicalc-roi

Este directorio contiene documentacion integral para la calculadora TCO de klaUS-aicalc-roi, con enfasis en el sofisticado algoritmo de dimensionamiento de hardware introducido en v2.0.

## Navegacion Rapida

### Conceptos Principales

- **[dimensionamiento-hardware.md](dimensionamiento-hardware.md)** — La base matematica
  - Derivacion de formula de caché KV
  - Calculos de usuarios concurrentes
  - Impacto de precision (FP16 vs FP8 vs INT4)
  - Ejemplos del mundo real
  - Referencias industriales

- **[calculo-latencia.md](calculo-latencia.md)** — Estimacion de rendimiento
  - Formula de tiempo al primer token (TTFT)
  - Calculos de factor de cola
  - Ajustes de rendimiento de precision
  - Orientacion SLO (objetivos sub-500ms, sub-2seg)
  - Ejemplos de latencia por tamaño de modelo

### Referencia de API

- **[api.md](api.md)** — Documentacion de punto final RESTful
  - `/v1/hardware/recommend` — Recomendacion avanzada de hardware
  - Definiciones de parametros y ejemplos
  - Tabla de impacto de precision
  - Manejo de errores

### Historial de Cambios

- **[registro-cambios-dimensionamiento.md](registro-cambios-dimensionamiento.md)** — Detalles de actualizacion v2.0
  - Comportamiento antes/despues
  - Cambios disruptivos (¡ninguno!)
  - Guia de migracion
  - Recomendaciones de prueba

---

## Novedades en v2.0

### El Problema

**Antes**: El dimensionamiento de hardware era ingenuo:
- "Llama 70B necesita 140 GB VRAM, así que usa 2× H100"
- Ratio fijo: 1 GPU por 2 usuarios concurrentes
- Sin consideracion de tamaño de modelo, precision o longitud de contexto

**Impacto en el mundo real**: Hardware sobre-aprovisionado para modelos pequeños, sub-aprovisionado para alta concurrencia.

### La Solucion

**Ahora**: Dimensionamiento sofisticado basado en requisitos de caché KV:

```
caché_kv_por_usuario = (parametros_modelo_miles / 1000) 
                      × tokens_ventana_contexto 
                      × factor_precision 
                      × 0.000122 GB

vram_total_necesario = pesos_modelo + (caché_kv_por_usuario × usuarios_concurrentes)

unidades_necesarias = ceil(vram_total_necesario / memoria_gpu)
```

### Impacto Real

**Escenario**: DeepSeek 7B, 16 usuarios concurrentes, contexto 4K

| Precision | VRAM Modelo | Caché KV | Total | H100s | Coste |
|-----------|-----------|----------|-------|-------|------|
| FP16 | 14 GB | 0.54 GB | 8.64 GB | 1 | $40K |
| FP8 | 7 GB | 0.27 GB | 4.27 GB | 1 | $40K |
| INT4 | 3.5 GB | 0.14 GB | 2.24 GB | 1 | $40K |

**Mismo hardware, 3.8× mejor coste-por-inferencia** usando INT4!

---

## Parametros de Configuracion

Los usuarios ahora pueden personalizar:

| Parametro | Tipo | Predeterminado | Rango | Impacto |
|-----------|------|---------|-------|--------|
| `usuarios_concurrentes` | int | 1 | 1-1000 | Unidades de hardware necesarias |
| `usuarios_totales` | int | 1 | 1-100K | Metricas de negocio |
| `precision` | enum | FP16 | FP16/FP8/INT4 | VRAM y rendimiento |
| `tokens_ventana_contexto` | int | 4096 | 512-128K | Tamaño de caché KV |

---

## Perspectivas Clave

### 1. La Precision Escala Linealmente con VRAM
- INT4 = 25% de VRAM FP16
- FP8 = 50% de VRAM FP16

### 2. El Caché KV Domina a Escala
- Usuario unico: pesos_modelo >> caché_kv
- 32 usuarios concurrentes: caché_kv puede exceder pesos_modelo
- 100+ usuarios concurrentes: Se necesita multi-GPU solo para caché KV

### 3. La Ventana de Contexto es Exponencial
- Contexto 4K: 0.035 GB por usuario (Llama 70B, FP16)
- Contexto 32K: 0.28 GB por usuario (8× mayor)
- Contexto 128K: 1.12 GB por usuario (32× mayor)

### 4. El Tamaño del Modelo Importa
- Llama 70B: ~1.9 GB por usuario por 32K tokens
- DeepSeek 7B: ~0.2 GB por usuario por 32K tokens
- Modelo pequeño 3B: ~0.08 GB por usuario por 32K tokens

---

## Ejemplos de Recomendacion de Hardware

### Ejemplo 1: Configuracion de Desarrollo
**Llama 2 7B, 2 usuarios concurrentes, contexto 4K, FP16**
- Modelo: 14 GB
- Caché KV: 0.07 GB
- **Recomendacion**: 1× RTX 4090 (24 GB) ✓

### Ejemplo 2: Produccion Multi-Usuario
**Llama 2 70B, 16 usuarios concurrentes, contexto 32K, FP8**
- Modelo: 70 GB
- Caché KV: 4.48 GB
- **Recomendacion**: 2× H100 (160 GB) ✓

### Ejemplo 3: API de Alta Concurrencia
**DeepSeek 7B, 100 usuarios concurrentes, contexto 4K, INT4**
- Modelo: 3.5 GB
- Caché KV: 1.4 GB
- **Recomendacion**: 1-2× H100 dependiendo del margen de seguridad

---

## Prueba de Tu Configuracion

Para verificar el dimensionamiento de hardware:

1. **Obtén las especificaciones del modelo** desde el punto final `/v1/models`
2. **Calcula usando la formula** (ver dimensionamiento-hardware.md)
3. **Obtén recomendacion** desde `/v1/hardware/recommend`
4. **Verifica** con despliegue real de vLLM

Ejemplo de validacion:
```bash
# Tu configuracion
PARAMETROS_MODELO=70B
CONTEXTO=32768
USUARIOS=8
PRECISION=FP8

# Calcula caché KV esperado
# = (70 / 1000) × 32768 × 0.5 × 0.000122
# ≈ 0.14 GB por usuario

# Total esperado
# = 70 GB (modelo) + (0.14 × 8) = 71.12 GB
# → Cabe en 1× H100 con margen ✓
```

---

## Proximos Pasos

1. **Para Usuarios**: Lee [dimensionamiento-hardware.md](dimensionamiento-hardware.md) para orientacion de dimensionamiento
2. **Para Desarrolladores**: Revisa [api.md](api.md) para detalles de punto final
3. **Para Operadores**: Ve [calculo-latencia.md](calculo-latencia.md) para planificacion SLO
4. **Para Contribuidores**: Revisa [registro-cambios-dimensionamiento.md](registro-cambios-dimensionamiento.md) para detalles de implementacion

---

## Referencias Cientificas

- **Formula de Caché KV**: 2 × L × H_kv × D × S × bytes_por_elemento
- **Articulos vLLM**: https://arxiv.org/abs/2309.06180
- **Documentacion de Inferencia NVIDIA**: https://developer.nvidia.com/blog/
- **Optimizacion Meta Llama**: https://llama.meta.com/docs/model-architecture/

---

## Preguntas

- **Preguntas de API**: Ve [api.md](api.md)
- **Preguntas de Dimensionamiento**: Ve [dimensionamiento-hardware.md](dimensionamiento-hardware.md)
- **Preguntas de Latencia**: Ve [calculo-latencia.md](calculo-latencia.md)
- **Detalles de Implementacion**: Ve [registro-cambios-dimensionamiento.md](registro-cambios-dimensionamiento.md)

