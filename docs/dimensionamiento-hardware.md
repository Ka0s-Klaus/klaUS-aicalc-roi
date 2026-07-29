# Algoritmo de Dimensionamiento de Hardware para Inferencia de LLM

## Descripción General

El sistema klaUS-aicalc-roi calcula los requisitos de GPU para inferencia local de LLM utilizando un modelo sofisticado que considera:

1. **VRAM de Pesos del Modelo**: Espacio necesario para cargar los parámetros del modelo
2. **Requisitos de Caché KV**: Memoria para caché de clave-valor entre usuarios concurrentes
3. **Precisión de Inferencia**: Cuantización FP16, FP8 o INT4
4. **Perfil de Concurrencia**: Número de usuarios concurrentes y tamaño de ventana de contexto

## Fórmula de Dimensionamiento

### Paso 1: VRAM de Pesos del Modelo
```
unidades_para_modelo = ceil(modelo.vram_min_gb / gpu.vram_gb)
```

Esto asegura que la GPU tenga suficiente memoria para cargar los parámetros del modelo.

### Paso 2: Caché KV por Usuario

El requisito de caché KV es el factor dominante en el dimensionamiento de inferencia concurrente. Basado en el modelo matemático de NVIDIA y vLLM:

```
caché_kv_por_usuario_gb = (parametros_modelo_miles / 1000) 
                         × tokens_ventana_contexto 
                         × factor_precision 
                         × 0.000122
```

Donde:
- **parametros_modelo_miles**: Tamaño del modelo (p. ej., 7B, 13B, 70B)
- **tokens_ventana_contexto**: Longitud de contexto promedio esperada (p. ej., 4096, 32768, 128000)
- **factor_precision**: 
  - FP16: 1.0 (base, 2 bytes por elemento)
  - FP8: 0.5 (1 byte por elemento)
  - INT4: 0.25 (0.5 bytes por elemento)
- **0.000122**: Constante de escalado empírica derivada de estudios de caché KV de la industria

### Paso 3: Caché KV para Todos los Usuarios Concurrentes

```
caché_kv_total_necesario = caché_kv_por_usuario_gb × usuarios_concurrentes
```

### Paso 4: VRAM Disponible por GPU

Después de cargar el modelo, calcula la memoria restante para caché KV:

```
vram_disponible_por_gpu = gpu.vram_gb - (modelo.vram_min_gb / unidades_para_modelo)
```

### Paso 5: Unidades Necesarias para Concurrencia

```
unidades_para_kv = ceil(caché_kv_total_necesario / vram_disponible_por_gpu)
```

### Paso 6: Recomendación Final

```
unidades_necesarias = max(unidades_para_modelo, unidades_para_kv)
unidades_necesarias = max(unidades_necesarias, 1)  # Al menos 1 unidad
```

## Ejemplos

### Ejemplo 1: Llama 2 70B, 8 Usuarios Concurrentes, Contexto 4K, FP16

- Parámetros del modelo: 70B
- vram_min_gb: 140 (70B × 2 bytes para FP16)
- Contexto: 4096 tokens
- Precisión: FP16 (factor 1.0)

Caché KV por usuario:
```
= (70 / 1000) × 4096 × 1.0 × 0.000122
= 0.07 × 4096 × 0.000122
≈ 0.035 GB por usuario
```

Caché KV total necesario:
```
= 0.035 × 8 usuarios concurrentes
= 0.28 GB
```

Para un H100 (80GB):
- Unidades para modelo: ceil(140 / 80) = 2 unidades
- Disponible por GPU: 80 - (140/2) = 10 GB
- Unidades para KV: ceil(0.28 / 10) = 1 unidad
- **Resultado: 2 unidades (H100 SXM)**

### Ejemplo 2: Llama 2 70B, 8 Usuarios Concurrentes, Contexto 128K, FP8

- Parámetros del modelo: 70B
- vram_min_gb: 70 (70B × 1 byte para FP8)
- Contexto: 131072 tokens
- Precisión: FP8 (factor 0.5)

Caché KV por usuario:
```
= (70 / 1000) × 131072 × 0.5 × 0.000122
= 0.07 × 131072 × 0.5 × 0.000122
≈ 0.56 GB por usuario
```

Caché KV total necesario:
```
= 0.56 × 8 usuarios concurrentes
= 4.48 GB
```

Para un H100 (80GB):
- Unidades para modelo: ceil(70 / 80) = 1 unidad
- Disponible por GPU: 80 - 70 = 10 GB
- Unidades para KV: ceil(4.48 / 10) = 1 unidad
- **Resultado: 1 unidad (H100 SXM)**

### Ejemplo 3: Llama 2 70B, 32 Usuarios Concurrentes, Contexto 128K, FP8

Caché KV por usuario: ≈ 0.56 GB (igual que arriba)

Caché KV total necesario:
```
= 0.56 × 32 usuarios concurrentes
= 17.92 GB
```

Para un H100 (80GB):
- Unidades para modelo: ceil(70 / 80) = 1 unidad
- Disponible por GPU: 80 - 70 = 10 GB
- Unidades para KV: ceil(17.92 / 10) = 2 unidades
- **Resultado: 2 unidades (H100 SXM)**

## Suposiciones Clave

1. **La Cuantización Reduce VRAM Linealmente**: FP8 usa la mitad de VRAM que FP16, INT4 usa una cuarta parte
2. **Caché KV Escala con Tamaño del Modelo y Contexto**: Modelos más grandes y contextos más largos requieren exponencialmente más caché KV
3. **Los Usuarios Concurrentes son Aditivos**: Cada usuario concurrente requiere su propio espacio de caché KV
4. **Sobre-aprovisionamiento de GPU es Saludable**: Los despliegues reales a menudo utilizan utilización de memoria GPU del 70-80% para márgenes de seguridad

## Parámetros de Configuración

Los usuarios pueden personalizar:

| Parámetro | Tipo | Predeterminado | Rango | Descripción |
|-----------|------|---------|-------|-------------|
| `usuarios_concurrentes` | int | 1 | 1-1000 | Número de solicitudes de inferencia simultáneas |
| `usuarios_totales` | int | 1 | 1-100000 | Usuarios únicos totales (para métricas de negocio) |
| `precision` | enum | FP16 | FP16/FP8/INT4 | Precisión de inferencia (afecta VRAM y rendimiento) |
| `tokens_ventana_contexto` | int | 4096 | 512-131072 | Longitud de contexto promedio esperada |

## Punto Final de API

```
GET /v1/hardware/recommend
  ?vram_min_gb=140
  &usuarios_concurrentes=8
  &precision=FP16
  &tokens_ventana_contexto=4096
  &parametros_modelo_miles=70
```

Devuelve una lista de opciones de hardware ordenadas por `(unidades_necesarias, precio_total)`.

## Referencias Científicas

- **Fórmula de Caché KV**: 2 × L × H_kv × D × S × bytes_por_elemento
  - L: número de capas
  - H_kv: cabezas de atención KV
  - D: dimensión de cabeza
  - S: longitud de secuencia
  
- **Datos de la Industria**:
  - Puntos de referencia de inferencia de NVIDIA H100/A100
  - Estudios de lotes continuos de vLLM
  - Recomendaciones de inferencia de Meta Llama
  - Documentos de optimización de inferencia de Groq

## Mejoras Futuras

1. **Paralelismo de Tensor**: Fragmentación de modelo multi-GPU para reducir necesidades de VRAM por GPU
2. **Cuantización de Caché KV**: Cachés KV de 4 bits para reducir memoria adicional
3. **Lotes Dinámicos**: Tamaños de lote variables basados en SLAs de latencia
4. **Decodificación Especulativa**: Reducir tokens por solicitud para inferencia más rápida
