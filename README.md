# Synapse Labs Trading Bot Desktop

Repositorio público: https://github.com/synapselabsapp/trading-agent-desktop

Aplicación Electron autocontenida ejecutada desde código fuente. Funciona como una ventana de escritorio y no como PWA o página abierta manualmente.

## Arquitectura local

La aplicación no consume servicios remotos de Synapse. Sus conexiones posibles son:

- Binance Global: API oficial `https://fapi.binance.com`
- Binance US: API oficial `https://api.binance.us`
- Coinbase: API oficial `https://api.coinbase.com`
- Hermes Agent: CLI local instalado en este equipo para el chat de Arrow Agent

El monitor local solo lee la cuenta y las posiciones. No crea órdenes ni necesita permisos de trading.

## Archivos autocontenidos

La aplicación no depende de carpetas superiores del repositorio. Todos los recursos visuales utilizados están incluidos en:

- `assets/css/style.css`
- `assets/images/Logo Synapse Labs new.png`
- `assets/images/Arrow Bot AI pro.png`
- `assets/images/Favicon Synapse Labs.ico`

`main.cjs` sirve `renderer/` y `assets/` desde la propia carpeta `trading-agent-desktop`. La carpeta completa puede trasladarse fuera del repositorio sin romper logos, estilos o imágenes.

## Ejecutar en Windows

### Opción sencilla

Abre esta carpeta en el Explorador y haz doble clic en:

`START_APP.cmd`

El launcher comprueba Node/npm, instala Electron automáticamente si falta, abre la ventana y cierra la consola de inicio.

### Desde una terminal

```bash
cd "C:\dev\Synapse Labs VPS 2.0\Synapse Labs\apps\trading-agent-desktop"
npm install
npm start
```

Requisitos: Node.js 20 o superior, Hermes Agent instalado y configurado, y la carpeta completa `trading-agent-desktop`.

## Configurar Hermes Agent

`Agent Setup` comprueba que `hermes.exe` esté instalado y accesible. Si falta:

1. Pulsa `Open Hermes installation guide`.
2. Instala Hermes Agent desde la documentación oficial.
3. Configura el proveedor/modelo mediante el flujo oficial de Hermes.
4. Regresa a Synapse y pulsa `Check again`.
5. Cuando los tres pasos indiquen `READY`, continúa con Arrow Agent.

Synapse no copia, solicita ni almacena claves de Hermes. Para cada pregunta, el proceso principal ejecuta un one-shot local de Hermes con `--toolsets clarify`, `--ignore-rules` y una política explícita de salida JSON. Eso deja fuera del puente del chat las herramientas de terminal, archivos, navegador, código, delegación y automatización.

El agente recibe un snapshot saneado del estado actual justo antes de cada mensaje. Solo puede proponer seleccionar un exchange o iniciar/detener el monitor; Synapse valida esas acciones y exige confirmación explícita del usuario antes de aplicar el mismo control disponible en la UI.

Consulta `docs/HERMES_AGENT_INTEGRATION.md` para detalles y solución de problemas.

## Credenciales de exchanges

1. Selecciona el exchange.
2. Abre `API credentials`.
3. Usa una API key de solo lectura.
4. Guarda las credenciales.

Binance Global y Binance US usan API key + API secret. Coinbase usa el nombre completo de la CDP API key y su EC private key en formato PEM.

Electron cifra cada registro mediante `safeStorage` de Windows. Las credenciales descifradas solo existen en el proceso principal durante una consulta y nunca llegan al mensaje enviado a Arrow Agent o Hermes.

## Seguridad

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- IPC limitado a credenciales, cuenta, monitor, comprobación de Hermes, guía oficial y chat validado
- Guía externa limitada al dominio oficial de Hermes Agent
- El chat solo habilita el toolset `clarify`; no entrega herramientas operativas al modelo
- Credenciales de exchange excluidas del renderer, logs y contexto del agente
- Respuestas limitadas a texto y acciones estructuradas allowlisted
- Acciones propuestas siempre requieren confirmación en la UI
- Sin permisos ni código para ejecutar órdenes

## Verificación

```bash
npm run check
npm run smoke
npm run assistant-greeting-smoke
```

No existe configuración de electron-builder, instalador propio, release binario ni carpeta `dist`.

## Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulta el archivo `LICENSE` para el texto completo.
