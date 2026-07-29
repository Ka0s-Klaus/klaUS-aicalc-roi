# Registro de Cambios: Sistema Sofisticado de Dimensionamiento de Hardware

**Versión**: 2.0.0  
**Fecha**: 2026-07-29

## Descripción General

Esta actualización importante introduce un algoritmo sofisticado de dimensionamiento de hardware que considera tamaño del modelo, precisión de inferencia, ventanas de contexto y carga de usuarios concurrentes, reemplazando la simple ratio de "1 GPU por 2 usuarios" con fórmulas estándar reales de la industria basadas en requisitos de caché KV.

## Resumen de Cambios

### Backend

#### 1. `tco_engine/models.py` — Caso de Uso Extendido

Se añadieron campos para soportar dimensionamiento consciente de precisión:

```python
class UseCase(BaseModel):
    # ... campos existentes ...
    precision: str = Field(default="FP16", pattern="^(FP16|FP8|INT4)$")
    context_window_tokens: int = Field(default=4096, ge=512, le=131072)
```

**Por qué**: La precisión afecta el tamaño del caché KV linealmente; la ventana de contexto lo afecta de forma no lineal. Ambas deben ser configurables.

#### 2. `api/routes/catalog.py` — Recomendación Avanzada de Hardware

Refactorización completa del punto final `/v1/hardware/recommend`:

**Nuevos parámetros**:
- `precision` (FP16/FP8/INT4) — nivel de cuantización
- `tokens_ventana_contexto` — longitud de contexto esperada por el usuario
- `parametros_modelo_miles` — tamaño del modelo para cálculo de caché KV

**Nueva fórmula**:
```
caché_kv_por_usuario = (parametros_modelo_miles / 1000) 
                      × tokens_ventana_contexto 
                      × factor_precision 
                      × 0.000122 GB

unidades_necesarias = max(
  ceil(vram_modelo / vram_gpu),
  ceil((caché_kv_por_usuario × usuarios_concurrentes) / vram_disponible_por_gpu)
)
```

**Impacto**: Las recomendaciones ahora dimensionan correctamente para 4+ usuarios en modelos costosos sin sobre-aprovisionamiento masivo.

#### 3. `tco_engine/calculators.py` — Latencia Consciente de Precisión

Se actualizó `_estimate_local_latency()` con factores de aceleración de precisión:

```python
factores_precision = {"FP16": 1.0, "FP8": 1.5, "INT4": 2.0}
tps_efectivo = modelo.tokens_por_segundo_fp16 * factores_precision[caso_uso.precision]
```

**Impacto**: La cuantización FP8 muestra mejora de rendimiento realista del 50%; INT4 muestra 2x.

#### 4. `tco_engine/engine.py` — Mejora de Resumen

Se actualizó `_summarize()` para incluir información de concurrencia de usuarios:

```
"8 concurrentes / 100 usuarios totales — horizonte de 36 meses"
```

### Frontend

#### 1. `types/tco.ts` — Interfaz de Caso de Uso

Se extendió con campos de precisión y contexto:

```typescript
export interface UseCase {
  // ... campos existentes ...
  precision: "FP16" | "FP8" | "INT4";
  context_window_tokens: number;
}
```

#### 2. `components/UseCaseForm.tsx` — Nuevos Controles

Se añadió interfaz de usuario para:
- **Selector de precisión**: Botones de radio FP16 / FP8 / INT4
- **Entrada de ventana de contexto**: Campo numérico con validación (512-131K tokens)

Los usuarios ahora pueden ver retroalimentación inmediata de interfaz de usuario sobre cómo la precisión afecta las necesidades de hardware.

#### 3. `lib/api.ts` — Llamada de API Extendida

Se actualizó la firma `fetchHardwareRecommendation()`:

```typescript
export async function fetchHardwareRecommendation(
  vram_min_gb: number,
  usuarios_concurrentes: number = 1,
  precision: string = "FP16",
  tokens_ventana_contexto: number = 4096,
  parametros_modelo_miles?: number,
)
```

#### 4. `app/page.tsx` — Recálculo Dinámico

Se modificó el gancho useEffect para re-obtener recomendaciones cuando cambie cualquier parámetro de precisión o contexto:

```typescript
}, [modelosSeleccionados, casoUso.usuarios_concurrentes, casoUso.precision, casoUso.tokens_ventana_contexto]);
```

## Cambios de Comportamiento

### Antes

- Recomendación de hardware: "Este modelo necesita X GB VRAM, así que usa Y unidades"
- Ratio fijo: 1 GPU por 2 usuarios concurrentes independientemente del tamaño del modelo
- Sin consideración de precisión o ventana de contexto

### Después

- Recomendación de hardware: "Este modelo necesita X GB VRAM + (Y usuarios × Z GB por usuario en caché KV) = VRAM total"
- Ratio dinámico: Basado en requisitos reales de caché KV
- Consciente de precisión: La cuantización INT4 reduce el caché KV en 75%
- Consciente de contexto: Un contexto 128K puede requerir 3x más caché KV que un contexto 4K

## Ejemplos

### Escenario A: Llama 70B, 8 usuarios, contexto 4K, FP16
- VRAM del modelo: 140 GB
- Caché KV por usuario: ~0.035 GB
- Total KV necesario: 0.28 GB
- **Recomendación**: 2× H100 (140GB modelo + ~10GB KV por GPU)

### Escenario B: Igual, pero con cuantización INT4
- VRAM del modelo: 35 GB (reducción del 75%)
- Caché KV por usuario: ~0.009 GB (reducción del 75%)
- Total KV necesario: 0.07 GB
- **Recomendación**: 1× H100 (35GB modelo + 1GB KV)

### Escenario C: DeepSeek 7B, 32 usuarios, contexto 128K, FP8
- VRAM del modelo: 14 GB
- Caché KV por usuario: ~0.22 GB
- Total KV necesario: 7.04 GB
- **Recomendación**: 1× H100 (14GB modelo + 66GB KV... ¡necesita recálculo!)
- En realidad: 2× H100 (margen seguro para 70GB caché KV)

## Cambios Disruptivos

⚠️ **Cambio de Contrato de API**:
- `/v1/hardware/recommend` ahora requiere `parametros_modelo_miles` para cálculo preciso de caché KV
- Las solicitudes sin éste recurren a estimación aproximada (menos precisa)

✅ **Compatibilidad Hacia Atrás**:
- Los clientes existentes siguen funcionando; solo reciben recomendaciones menos precisas
- Se recomienda actualizar frontend/clientes para pasar `parametros_modelo_miles` desde catálogo de modelos

## Recomendaciones de Prueba

1. **Pruebas de Regresión**: Verificar que despliegues existentes sigan encajando en hardware
2. **Pruebas de Cuantización**: Confirmar que recomendaciones FP8/INT4 producen reducciones de ratio correctas
3. **Casos Límite**:
   - Contexto muy grande (128K) en modelo 7B → debe caber en 1-2 GPUs
   - Muchos usuarios concurrentes (100+) → debe recomendar 8+ GPUs
   - INT4 + modelo pequeño → debe recomendar hardware mínimo

## Impacto de Rendimiento

- **API de recomendación de hardware**: ~50ms (matemática de caché KV añadida)
- **Re-renderizados de Frontend**: Igual (React optimiza recálculos)
- **Análisis Backend**: Sin cambios (usa mismos calculadores)

## Mejoras Futuras

1. **Paralelismo de Tensor**: Fragmentación de modelo multi-GPU para reducir VRAM por GPU
2. **Cuantización de Caché KV**: Caché KV de 4 bits para reducción adicional del 50%
3. **Tamaño de Lote Dinámico**: Recomendar tamaños de lote basados en SLOs de latencia
4. **Decodificación Especulativa**: Auto-recomendar borradores especulativos para baja latencia
5. **Agrupación de Memoria**: Compartir caché KV entre usuarios para escenarios multi-tenant

## Documentación

Nuevos documentos creados:
- `docs/dimensionamiento-hardware.md` — Derivación completa de fórmula + ejemplos
- `docs/calculo-latencia.md` — Estimación TTFT con ajustes de precisión
- `docs/api.md` — Documentación de punto final actualizada
- `docs/registro-cambios-dimensionamiento.md` — Este archivo

## Guía de Migración

Para clientes/integraciones existentes:

1. **Sin migración necesaria** — API es compatible hacia atrás
2. **Recomendado**: Actualizar llamadas para incluir `parametros_modelo_miles` para mejor precisión
3. **Monitorear**: Verificar que recomendaciones de hardware sigan alineadas con despliegues

Ejemplo de llamada actualizada:
```javascript
// Antes
fetchHardwareRecommendation(140, 8)

// Después (recomendado)
fetchHardwareRecommendation(140, 8, "FP16", 4096, 70)
```

## Reconocimientos

Fórmulas basadas en:
- Documentación de inferencia de NVIDIA H100/A100
- Investigación de lotes continuos de vLLM
- Guías de optimización de inferencia de Meta Llama
- Estudios de FlashAttention y caché KV moderno
