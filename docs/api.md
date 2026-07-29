# Documentacion de API de klaUS-aicalc-roi

## Descripcion General

La API de klaUS-aicalc-roi proporciona analisis de TCO (Coste Total de Propiedad) para decisiones de infraestructura AI, incluyendo catalogos de modelos, recomendaciones de hardware y calculos de coste.

## URL Base

```
http://localhost:8000
```

Configura la variable de entorno `NEXT_PUBLIC_API_URL` para sobrescribir.

---

## Punto Final

### 1. Recomendacion de Hardware (Avanzado)

**GET** `/v1/hardware/recommend`

Recomienda opciones de hardware para ejecutar un modelo con concurrencia y precision especificadas.

#### Parametros de Consulta

| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|----------|-------------|
| `min_vram_gb` | float | ✓ | Requisito de VRAM del peso del modelo en GB |
| `concurrent_users` | int | opcional | Numero de solicitudes de inferencia concurrentes (predeterminado: 1) |
| `precision` | string | opcional | Precision de inferencia: `FP16`, `FP8`, `INT4` (predeterminado: `FP16`) |
| `context_window_tokens` | int | opcional | Longitud de contexto promedio en tokens (predeterminado: 4096, rango: 512-131072) |
| `model_params_billions` | float | opcional | Tamaño del modelo en miles de millones para calculo mejorado de caché KV |

#### Logica de Dimensionamiento

El punto final calcula requisitos de hardware usando la formula sofisticada documentada en [dimensionamiento-hardware.md](dimensionamiento-hardware.md):

```
unidades_totales_necesarias = max(
  ceil(vram_modelo / vram_gpu),                  # Pesos del modelo
  ceil(caché_kv_para_todos / vram_disponible)   # Concurrencia
)
```

Donde el caché KV por usuario se estima como:
```
caché_kv_por_usuario = (parametros_modelo_miles / 1000) 
                      × tokens_contexto 
                      × factor_precision 
                      × 0.000122 GB
```

#### Respuesta

```json
[
  {
    "hardware": {
      "id": "h100-80gb",
      "name": "NVIDIA H100 80GB SXM",
      "vram_gb": 80,
      "tdp_watts": 700,
      "purchase_price_usd": "40000",
      "quantity": 1
    },
    "units_needed": 2,
    "total_vram_gb": 160,
    "total_price_usd": "80000"
  }
]
```

#### Ejemplos

**Ejemplo 1: Llama 70B, 8 usuarios concurrentes, FP16, contexto 4K**

```
GET /v1/hardware/recommend
  ?min_vram_gb=140
  &concurrent_users=8
  &precision=FP16
  &context_window_tokens=4096
  &model_params_billions=70
```

**Ejemplo 2: DeepSeek 7B, 32 usuarios concurrentes, INT4, contexto 32K**

```
GET /v1/hardware/recommend
  ?min_vram_gb=7
  &concurrent_users=32
  &precision=INT4
  &context_window_tokens=32768
  &model_params_billions=7
```

---

## Impacto de Precision en Dimensionamiento de Hardware

| Precision | Bytes por Token | Reduccion VRAM | Mejora de Rendimiento |
|-----------|-----------------|----------------|----------------------|
| FP16 | 2 bytes | baseline | 1.0x |
| FP8 | 1 byte | -50% | 1.5x |
| INT4 | 0.5 bytes | -75% | 2.0x |

Ejemplo: Llama 70B con 8 usuarios concurrentes, contexto 128K
- **FP16**: 2× H100 (40 GB caché KV necesario)
- **FP8**: 1-2× H100 (20 GB caché KV necesario)
- **INT4**: 1× H100 (10 GB caché KV necesario)

---

## Manejo de Errores

Todos los puntos finales devuelven codigos de error HTTP con mensajes descriptivos:

```json
{
  "detail": "Los parametros del modelo deben ser positivos"
}
```

Codigos comunes:
- **400**: Solicitud incorrecta (parametros invalidos)
- **422**: Error de validacion (p. ej., min_vram_gb <= 0)
- **500**: Error del servidor
