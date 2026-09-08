# Evidence — 010 cash float at close

Screenshots of the built app (`npm run build`, Playwright driving `out/main/index.js`
against a fresh database, seed admin) for the acceptance scenarios in
[`specs/010-cash-float-close/spec.md`](../../../../specs/010-cash-float-close/spec.md).
Fixture: default float 600.000 configured, register opened with 600.000, one cash
income of 590.000, counted 1.190.000.

| File | What it shows |
| --- | --- |
| `01-configuracion-caja.png` | Configuración › Caja card with "Fondo de caja por defecto" (admin only). |
| `02-cierre-fondo-600-retiro-590.png` | Close screen: expected 1.190.000, counted 1.190.000, difference 0, float prefilled 600.000, "A retirar / entregar" 590.000. |
| `03-cierre-validacion-fondo-mayor-que-contado.png` | Counted 400.000 with float 620.000: inline error, confirm button disabled; the arqueo still shows the real difference. |
| `04-caja-cerrada-fondo-retiro.png` | Post-close view with "Queda en caja (fondo)" and "Retiro / entrega". |
| `05-apertura-prefill-ultimo-cierre.png` | Next opening proposes the float left by the last close, with date and time. |
| `06-reportes-cierres-quedo-retiro-notas.png` | Reportes › Cierres Caja with Quedó / Retiro / Notas columns. |
| `07-pdf-cierre-fondo-retiro-observaciones.png` | Close PDF: fondo and retiro under the arqueo, close observations printed as a footnote. |

Images are downscaled to 1440 px wide to keep the repository light.
