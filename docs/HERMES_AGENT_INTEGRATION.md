# Integración de Hermes Agent

## Skills de Arrow

Cuando la app detecta `hermes.exe`, copia automáticamente las skills públicas incluidas en `skills/arrow-desktop-app/` hacia `%HERMES_HOME%\skills\arrow-desktop-app`. La instalación copia únicamente archivos faltantes y conserva cualquier personalización existente del usuario.

Si la copia falla, el flujo Agent Setup muestra una acción para reintentarla antes de habilitar Arrow Agent.

## Flujo

1. Synapse detecta `hermes.exe` con `where.exe` y rutas conocidas del instalador de Hermes.
2. `Agent Setup` muestra la versión detectada sin leer claves ni tokens.
3. Si Hermes falta, el botón abre únicamente la guía oficial de instalación:
   `https://hermes-agent.nousresearch.com/docs/getting-started/installation/`
4. El chat se queda dentro del panel `Arrow Agent`.
5. El proceso principal ejecuta Hermes con `-z`, `--toolsets clarify`, `--ignore-rules` y `--reasoning low`.
6. Hermes debe devolver un único objeto JSON `{ reply, actions }`. Synapse valida el JSON y elimina cualquier acción no permitida.

## Límite de herramientas

El puente no expone una URL, token, sesión del gateway ni IPC genérico. El one-shot recibe únicamente el toolset `clarify`, necesario para que una ejecución sin TTY no se bloquee si el modelo intenta pedir una aclaración. No se entregan terminal, archivos, navegador, código, memoria, skills, delegación, cron ni control del escritorio.

La política del prompt obliga a analizar solo el snapshot no secreto enviado por Synapse. El modelo no puede afirmar que inspeccionó archivos, credenciales, órdenes, pantallas, dispositivos o sistemas externos.

## Snapshot permitido

Antes de cada mensaje, Synapse construye y vuelve a sanear:

- exchange seleccionado;
- estado del monitor;
- presencia de credenciales como booleano;
- balance, capital disponible y valor total;
- posiciones abiertas con símbolo, lado, tamaño, entrada, mark, PnL, leverage, liquidación y distancia de riesgo;
- órdenes con símbolo, lado, tipo, estado, precio, cantidad y `reduceOnly`;
- fecha de actualización.

No se aceptan ni se incluyen API keys, secretos, firmas, tokens, campos desconocidos o contenido cifrado.

## Acciones

El resultado del modelo puede proponer únicamente:

- `set_exchange`: `binance`, `binance_us` o `coinbase`;
- `set_monitor`: `start` o `stop`.

El proceso principal valida la respuesta. El renderer vuelve a validar la etiqueta y muestra un botón `Apply`; nada cambia hasta que el usuario confirma y el control correspondiente sigue disponible en Synapse.

## Solución de problemas

- Si aparece `Hermes Agent is not installed`, instala Hermes y vuelve a abrir la aplicación o pulsa `Check again`.
- Si Hermes está instalado pero Arrow Agent no responde, ejecuta `hermes --version` y después `hermes doctor` desde una terminal para revisar el proveedor/modelo configurado.
- Si la respuesta no es JSON, Synapse la rechaza y no aplica acciones.
- Un límite del proveedor se muestra como indisponibilidad temporal; no se muestran nombres de infraestructura ni secretos.

## Verificación manual

Desde la carpeta de la app:

```bash
npm run check
npm run smoke
npm run assistant-greeting-smoke
```

Para probar la misma superficie de Hermes fuera de Electron sin herramientas operativas:

```bash
hermes -z "Return exactly: HERMES_PROBE" --toolsets clarify --ignore-rules --reasoning low
```
