# Cálculo de Latencia en klaUS-aicalc-roi

## Descripción General

El sistema estima la latencia de **Tiempo al Primer Token (TTFT)** para despliegues de inferencia local. TTFT es crítico para la experiencia del usuario, ya que determina la rapidez con la que un usuario ve el primer token de una respuesta después de enviar un mensaje.

## Fórmula

```
TTFT (ms) = tiempo_generacion × factor_cola × ajuste_precision
```

### Componente 1: Tiempo de Generación

```
tiempo_generacion = (tokens_salida_promedio / tps_efectivo) × 1000
```

Donde:
- `tokens_salida_promedio` = 256 tokens (promedio empírico del primer bloque de respuesta)
- `tps_efectivo` = rendimiento en tokens/seg del modelo × factor de aceleración de precisión

### Componente 2: Factor de Cola

```
factor_cola = max(1.0, usuarios_concurrentes / capacidad_kv_gpu)
```

Donde:
- `capacidad_kv_gpu` = hardware.cantidad × 2
  - Cada GPU puede contener cómodamente ~2 cachés KV de usuarios concurrentes
- Si usuarios_concurrentes > capacidad, aumenta linealmente la latencia

### Componente 3: Ajuste de Precisión de Rendimiento

Las GPUs modernas (H100/A100) tienen conjuntos de instrucciones especiales (Motor Tensor) para aritmética de baja precisión:

```
factor_precision = {
  "FP16": 1.0,   # base (2 bytes por elemento, precisión estándar)
  "FP8": 1.5,    # 50% más rápido (1 byte por elemento, soporte fp8 de NVIDIA)
  "INT4": 2.0    # 2x más rápido (0.5 bytes por elemento, cuantización máxima)
}
```

## Ejemplos

### Ejemplo 1: Llama 70B, 4 usuarios concurrentes, FP16

Suposiciones:
- `tokens_por_segundo_fp16`: 15.5 tps
- `hardware.cantidad`: 1 (un H100)
- `usuarios_concurrentes`: 4

Cálculo:
```
tiempo_generacion = (256 / 15.5) × 1000 = 16.516 ms

factor_cola = max(1.0, 4 / (1 × 2)) = 2.0

TTFT = 16.516 × 2.0 × 1.0 = 33.032 ms ≈ 33 segundos
```

**Interpretación**: Con solo 1 GPU y 4 usuarios concurrentes, la cola se acumula significativamente. Cada usuario espera ~2x más debido a la contención de recursos.

### Ejemplo 2: Mismo Escenario pero 2 H100s con FP8

Suposiciones:
- `tokens_por_segundo_fp16`: 15.5 tps
- `hardware.cantidad`: 2 (dos H100s)
- `usuarios_concurrentes`: 4
- `precision`: FP8

Cálculo:
```
tps_efectivo = 15.5 × 1.5 = 23.25 tps

tiempo_generacion = (256 / 23.25) × 1000 = 11.005 ms

factor_cola = max(1.0, 4 / (2 × 2)) = 1.0

TTFT = 11.005 × 1.0 × 1.0 = 11.005 ms ≈ 11 segundos
```

**Interpretación**: Con 2 GPUs y precisión FP8, no se forma cola (4 usuarios caben exactamente), y el aumento de rendimiento reduce la latencia en ~40%.

### Ejemplo 3: DeepSeek 7B, 16 usuarios concurrentes, INT4

Suposiciones:
- `tokens_por_segundo_fp16`: 80 tps (modelo más pequeño, rendimiento más alto)
- `hardware.cantidad`: 2 H100s
- `usuarios_concurrentes`: 16
- `precision`: INT4

Cálculo:
```
tps_efectivo = 80 × 2.0 = 160 tps

tiempo_generacion = (256 / 160) × 1000 = 1.600 ms

factor_cola = max(1.0, 16 / (2 × 2)) = 4.0

TTFT = 1.600 × 4.0 × 1.0 = 6.400 ms ≈ 6,4 segundos
```

**Interpretación**: Modelo más pequeño + cuantización proporciona latencia base baja, pero la alta concurrencia aún causa cola. Se necesitan más GPUs o menos usuarios concurrentes para TTFT menor a 2 segundos.

## Orientación de SLO de Latencia (Objetivo de Nivel de Servicio)

Basado en estándares de la industria:

| SLO | Caso de Uso | Objetivo de Latencia |
|-----|----------|----------------|
| **Nivel 1** | Chat/codificación en tiempo real | <500 ms |
| **Nivel 2** | Alta capacidad de respuesta | 500 ms - 2 seg |
| **Nivel 3** | Amigable con lotes | 2-5 seg |
| **Nivel 4** | Fondo/asincrónico | >5 seg |

### Lograr TTFT Menor a 1 Segundo

Reglas prácticas:
1. **Modelo pequeño**: 7B es ~5x más rápido que 70B con la misma GPU
2. **Baja precisión**: INT4 es 2x más rápido que FP16
3. **Pocos usuarios concurrentes**: Mantener factor_cola ≈ 1.0
4. **Multi-GPU**: Cada GPU añade ~2 espacios de concurrencia

Configuración de ejemplo para <500ms:
- Modelo: DeepSeek-7B (80 tps en FP16)
- Precisión: INT4 (160 tps efectivo)
- Hardware: 2× H100
- Usuarios concurrentes: 4 (factor_cola = 1.0)
- TTFT ≈ 1.6 × 1.0 × 1.0 = **1,6 segundos** ❌ Aún demasiado alto

Para alcanzar <500ms, necesitarías:
- 3× GPUs → factor_cola permanece en 1.0
- TTFT ≈ 1.6 / (proporción de rendimiento de tokens) ≈ 800ms aún lento...

**Mejor**: Servir menos usuarios concurrentes:
- Modelo: DeepSeek-7B
- Precisión: INT4 (160 tps)
- Hardware: 1× H100
- Usuarios concurrentes: 1
- TTFT ≈ **1,6 segundos** (limitado por generación, no por cola)

El cuello de botella fundamental es la latencia de relleno previo. Incluso a 160 tps, rellenar previamente 256 tokens de salida toma ~1.6 segundos. Para <500ms, usa decodificación especulativa o contextos más pequeños.

## Notas de Implementación

El cálculo de latencia en la función `backend/tco_engine/calculators.py` `_estimate_local_latency()` aplica:
- Rendimiento del modelo desde catálogo
- Ajustes de precisión desde caso de uso
- Carga de usuarios concurrentes desde factor de cola

Esto es una **estimación aproximada** y la latencia real depende de:
- Arquitectura del modelo (algunas arquitecturas son más rápidas por parámetro)
- Ancho de banda de memoria de GPU (afecta rendimiento de relleno previo)
- Programación de tamaño de lote (lotes continuos de vLLM)
- Tiempo de ida y vuelta de red (si inferencia remota)

## Referencias

- **Definición TTFT**: Tiempo transcurrido desde enviar un mensaje hasta recibir el primer token de salida
- **Fase de Relleno Previo**: Procesar el mensaje completo (lento, O(N) tokens)
- **Fase de Decodificación**: Generar cada token de salida uno a la vez (rápido, O(1) por token)
- **Documentos vLLM**: https://docs.vllm.ai/
- **Optimización de Latencia de NVIDIA**: https://developer.nvidia.com/blog/
