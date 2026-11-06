---
tags: [proyecto/klaUS-aicalc-roi, tipo/guia, dimensionamiento/hardware]
---

# 📚 Guía de Estilo de Documentación

Este documento define el estándar de formato para toda la documentación del proyecto **klaUS-aicalc-roi** a partir de septiembre 2026.

## 🎯 Estructura de README.md

### Portada
```markdown
# 🧮 Nombre del Proyecto

> **Tagline en negrita.** Contexto adicional.

[![Badge1](url)](url) [![Badge2](url)](url)

---
```

### Sección central: "¿Qué hago? ¿Cómo lo hago? ¿Y para qué lo hago?"
```markdown
## 🤔 ¿Qué hago? ¿Cómo lo hago? ¿Y para qué lo hago?

**¿Qué hago:** [Párrafo 1 - qué es]
**¿Cómo lo hago:** [Párrafo 2 - técnica]
**¿Para qué lo hago:** [Párrafo 3 - valor/problema]

---
```

### Arquitectura (si aplica)
```markdown
## 🏗️ Arquitectura

[Flowchart Mermaid o diagrama ASCII]

**Stack:**
- Componente 1: tecnología
- Componente 2: tecnología

---
```

### Quick Start
```markdown
## 🚀 Instalación rápida

### Requisitos
- [Req 1]
- [Req 2]

### Pasos
[Código bash con comentarios]

---
```

### Características
```markdown
## 🎯 Características principales

| Característica | Descripción |
|---|---|
| 🔌 Feature 1 | Descripción breve |
| 💬 Feature 2 | Descripción breve |

---
```

### Secciones adicionales
```markdown
## ⚙️ Configuración

| Variable | Defecto | Descripción |
|---|---|---|
| VAR_1 | valor | qué hace |

---

## 📚 Documentación

| Doc | Contenido |
|---|---|
| [🏗️ File](docs/file.md) | Descripción |

---

## 🤝 Contribuir

1. Fork
2. Rama: `git checkout -b GH-{N}-desc`
3. Commit: `git commit -m "GH-{N}: desc"`
4. Push y PR

---

## 📄 Licencia

[MIT](LICENSE) — Libre para uso comercial.
```

## 🎨 Emojis por sección

| Sección | Emoji |
|---|---|
| Título principal | 🧮 (proyecto específico) |
| ¿Qué hago? | 🤔 |
| Arquitectura | 🏗️ |
| Quick Start | 🚀 |
| Características | 🎯 |
| Configuración | ⚙️ |
| Documentación | 📚 |
| Tests | 🧪 |
| Contribuir | 🤝 |
| Licencia | 📄 |

## ✅ Checklist

- [ ] Portada: `# 🎯 Nombre` + tagline + badges
- [ ] Sección "¿Qué hago? ¿Cómo? ¿Para qué?"
- [ ] Separadores `---` entre secciones
- [ ] Arquitectura con Mermaid (si ≥4 componentes)
- [ ] Quick Start con pasos claros
- [ ] Características en tabla con emojis
- [ ] Documentación enlazada a `docs/`
- [ ] Contribuir con pasos claros
- [ ] Licencia con enlace
- [ ] Emojis consistentes
- [ ] Sin párrafos largos (máx 4 líneas)
- [ ] Código en ```bash``` con comentarios

## 📝 Ejemplo

Ver README.md principal del proyecto como referencia aplicada.
