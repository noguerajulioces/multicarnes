# Changelog

All notable changes to this project are documented here. The format follows [Conventional Commits](https://www.conventionalcommits.org/) and [Semantic Versioning](https://semver.org/).

## [1.10.2](https://github.com/noguerajulioces/multicarnes/compare/v1.10.1...v1.10.2) (2026-07-13)

### Bug Fixes

* make database backup and restore WAL-safe ([#33](https://github.com/noguerajulioces/multicarnes/issues/33)) ([f9ac464](https://github.com/noguerajulioces/multicarnes/commit/f9ac46486771785afc68a666b44de6af20fc82b3))

## [1.10.1](https://github.com/noguerajulioces/multicarnes/compare/v1.10.0...v1.10.1) (2026-07-06)

### Features

* default customer fiado limit of 400.000 Gs, applied to new and existing customers ([f824057](https://github.com/noguerajulioces/multicarnes/commit/f82405736347f38beb4d305cef3063969aa2e03c))

## [1.10.0](https://github.com/noguerajulioces/multicarnes/compare/v1.9.0...v1.10.0) (2026-06-28)

### Features

* implement daily cash-close report generation and download functionality ([4681a4e](https://github.com/noguerajulioces/multicarnes/commit/4681a4eb9242bf641b92ab4c86c2d5ce02ad8b21))
* implement no-negative-stock policy in sales processing ([fc1b7a9](https://github.com/noguerajulioces/multicarnes/commit/fc1b7a91f3e3adb8cf493a9ee3d76af189355db7))

## [1.9.0](https://github.com/noguerajulioces/multicarnes/compare/v1.8.4...v1.9.0) (2026-06-19)

### Features

* **reportes:** visibilidad de ventas mixtas (009) + rework del export de ventas con caja (010) ([#30](https://github.com/noguerajulioces/multicarnes/issues/30)) ([028813a](https://github.com/noguerajulioces/multicarnes/commit/028813a15e9e30dc2e0cb491ec423e1d4d91edb7))

### Bug Fixes

* add icon to backup and notification messages for better user experience ([f661613](https://github.com/noguerajulioces/multicarnes/commit/f6616136e3bf4aff408db60bc4312adef9c36f6f))
* auditoría aritmética — validaciones de servidor (fiado/stock), arqueo en anulaciones y perf del POS ([#29](https://github.com/noguerajulioces/multicarnes/issues/29)) ([020cfc8](https://github.com/noguerajulioces/multicarnes/commit/020cfc8834d8f7726b48e8208c4746a862647482)), closes [#1](https://github.com/noguerajulioces/multicarnes/issues/1) [#2](https://github.com/noguerajulioces/multicarnes/issues/2) [#3](https://github.com/noguerajulioces/multicarnes/issues/3) [#12](https://github.com/noguerajulioces/multicarnes/issues/12)

## [1.8.4](https://github.com/noguerajulioces/multicarnes/compare/v1.8.3...v1.8.4) (2026-06-12)

### Bug Fixes

* enhance rebuild:node script to remove stale better-sqlite3 metadata ([bd40c8f](https://github.com/noguerajulioces/multicarnes/commit/bd40c8f88c9749aeb28992d1cf04d968946f9fc4))
* update font family for improved print quality and consistency ([7c342c4](https://github.com/noguerajulioces/multicarnes/commit/7c342c4d444c229dfe1b489dd95da7fb29416d58))

### Performance

* de-jank POS, debounce searches, trim checkout, selective audit ([#28](https://github.com/noguerajulioces/multicarnes/issues/28)) ([7fa9692](https://github.com/noguerajulioces/multicarnes/commit/7fa9692f21fb9063d6d9da831dfb35dfcdc03a41))

### Refactoring

* update print styling and improve ticket calibration messages ([ca79f48](https://github.com/noguerajulioces/multicarnes/commit/ca79f48e2c01a6b161a78dbed7d100eaf6dd2bc8))

## [1.8.3](https://github.com/noguerajulioces/multicarnes/compare/v1.8.0...v1.8.3) (2026-06-09)

### Features

* Electron printing + printer dropdown, test print, and receipt config (footer/RUC) ([#26](https://github.com/noguerajulioces/multicarnes/issues/26)) ([1112c2b](https://github.com/noguerajulioces/multicarnes/commit/1112c2b67e7d832129fbb2482194ffab46df9202))

### Bug Fixes

* friendly duplicate-barcode message + report pagination & DB perf ([#27](https://github.com/noguerajulioces/multicarnes/issues/27)) ([6262ff5](https://github.com/noguerajulioces/multicarnes/commit/6262ff5e22a2694259b061e9d2d48d262a9b4747))

## [1.8.0](https://github.com/noguerajulioces/multicarnes/compare/v1.7.3...v1.8.0) (2026-06-02)

### Features

* per-customer credit limit + single-instance lock ([#25](https://github.com/noguerajulioces/multicarnes/issues/25)) ([9b826d2](https://github.com/noguerajulioces/multicarnes/commit/9b826d2a5be2de08205ef2143a3095120d1a1e65))

## [1.7.3](https://github.com/noguerajulioces/multicarnes/compare/v1.7.2...v1.7.3) (2026-05-27)

### Bug Fixes

* set default filter status to 'active' in ProductosPage ([ece543d](https://github.com/noguerajulioces/multicarnes/commit/ece543dbc0b457adc12f2b98aaec59cd44e272f7))

## [1.7.2](https://github.com/noguerajulioces/multicarnes/compare/v1.7.1...v1.7.2) (2026-05-26)

## [1.7.1](https://github.com/noguerajulioces/multicarnes/compare/v1.6.9...v1.7.1) (2026-05-26)

### Features

* **productos:** modos sumar/restar/reemplazar en ajuste de stock ([9b19d9c](https://github.com/noguerajulioces/multicarnes/commit/9b19d9c21db765144100730a1f7f4fb177f2a1ac))
* **ventas:** autofocus buscador y limpieza tras escanear/confirmar ([32384ba](https://github.com/noguerajulioces/multicarnes/commit/32384ba37b730634782c8d94a8cafa6ef0207654))
* **ventas:** improve barcode input handling for kg products ([56d2489](https://github.com/noguerajulioces/multicarnes/commit/56d2489205cf6216465ed77bf5ded6cf347ab9c7))
* **ventas:** lectura de código de barras robusta + balanza de peso variable ([4bf0d00](https://github.com/noguerajulioces/multicarnes/commit/4bf0d0001ad810efeaea4ffbfa252a17bc86deca))

### Bug Fixes

* **productos:** redondear stock por tipo de precio en ajuste ([03984b0](https://github.com/noguerajulioces/multicarnes/commit/03984b0e4ebc449c706e0aa1fa47542c0e7ee254))

### Documentation

* **readme:** actualizar a v1.6.9 (features 001-008, stack, testing) ([d06c909](https://github.com/noguerajulioces/multicarnes/commit/d06c909c7d3c4873bf032b02fde6a9876f5b3618))

## [1.6.9](https://github.com/noguerajulioces/multicarnes/compare/v1.6.0...v1.6.9) (2026-05-20)

### Features

* implement payment voiding functionality ([f1cf630](https://github.com/noguerajulioces/multicarnes/commit/f1cf63024394c25f0f165ebe5b76265687c3281a))
* **reports:** net revenue column in "Más Vendidos" ([#7](https://github.com/noguerajulioces/multicarnes/issues/7)) ([5a8288d](https://github.com/noguerajulioces/multicarnes/commit/5a8288d7604ba51f02813d97fb718c0ff8ae96d6))

### Bug Fixes

* **business:** phase-0 integrity guards for cash, sales and purchases ([08823f3](https://github.com/noguerajulioces/multicarnes/commit/08823f312e81bc04b23a7a6a16e1f06c4f1e7878)), closes [#6](https://github.com/noguerajulioces/multicarnes/issues/6) [#3a](https://github.com/noguerajulioces/multicarnes/issues/3a) [#11](https://github.com/noguerajulioces/multicarnes/issues/11) [#4a](https://github.com/noguerajulioces/multicarnes/issues/4a) [#10](https://github.com/noguerajulioces/multicarnes/issues/10)
* **business:** phase-1 — reverse cash on payment edit/delete + closed-register blocks ([a995201](https://github.com/noguerajulioces/multicarnes/commit/a995201aaa71072d8cb7b17c282ab7edeb729076)), closes [#1](https://github.com/noguerajulioces/multicarnes/issues/1) [#2](https://github.com/noguerajulioces/multicarnes/issues/2) [#2](https://github.com/noguerajulioces/multicarnes/issues/2)
* **business:** phase-2 guards — cancel-pending-only + cash-model doc ([a8323cf](https://github.com/noguerajulioces/multicarnes/commit/a8323cf41905e9b61ca13411f3dc408e59c2e6ec)), closes [#3b](https://github.com/noguerajulioces/multicarnes/issues/3b) [#9](https://github.com/noguerajulioces/multicarnes/issues/9)

### Refactoring

* **ui:** unify tables, buttons and cards for visual coherence ([e107936](https://github.com/noguerajulioces/multicarnes/commit/e107936264d15ca0d1be65c71cd752c2456de6d9))

### Build System

* rebuild better-sqlite3 for Electron before dev/start ([b0a46da](https://github.com/noguerajulioces/multicarnes/commit/b0a46dae8c772ea67d4fe2897babda3fd33d6202))

## [1.6.8](https://github.com/noguerajulioces/multicarnes/compare/v1.6.0...v1.6.8) (2026-05-20)

### Features

* implement payment voiding functionality ([f1cf630](https://github.com/noguerajulioces/multicarnes/commit/f1cf63024394c25f0f165ebe5b76265687c3281a))
* **reports:** net revenue column in "Más Vendidos" ([#7](https://github.com/noguerajulioces/multicarnes/issues/7)) ([5a8288d](https://github.com/noguerajulioces/multicarnes/commit/5a8288d7604ba51f02813d97fb718c0ff8ae96d6))

### Bug Fixes

* **business:** phase-0 integrity guards for cash, sales and purchases ([08823f3](https://github.com/noguerajulioces/multicarnes/commit/08823f312e81bc04b23a7a6a16e1f06c4f1e7878)), closes [#6](https://github.com/noguerajulioces/multicarnes/issues/6) [#3a](https://github.com/noguerajulioces/multicarnes/issues/3a) [#11](https://github.com/noguerajulioces/multicarnes/issues/11) [#4a](https://github.com/noguerajulioces/multicarnes/issues/4a) [#10](https://github.com/noguerajulioces/multicarnes/issues/10)
* **business:** phase-1 — reverse cash on payment edit/delete + closed-register blocks ([a995201](https://github.com/noguerajulioces/multicarnes/commit/a995201aaa71072d8cb7b17c282ab7edeb729076)), closes [#1](https://github.com/noguerajulioces/multicarnes/issues/1) [#2](https://github.com/noguerajulioces/multicarnes/issues/2) [#2](https://github.com/noguerajulioces/multicarnes/issues/2)
* **business:** phase-2 guards — cancel-pending-only + cash-model doc ([a8323cf](https://github.com/noguerajulioces/multicarnes/commit/a8323cf41905e9b61ca13411f3dc408e59c2e6ec)), closes [#3b](https://github.com/noguerajulioces/multicarnes/issues/3b) [#9](https://github.com/noguerajulioces/multicarnes/issues/9)

### Refactoring

* **ui:** unify tables, buttons and cards for visual coherence ([e107936](https://github.com/noguerajulioces/multicarnes/commit/e107936264d15ca0d1be65c71cd752c2456de6d9))

### Build System

* rebuild better-sqlite3 for Electron before dev/start ([b0a46da](https://github.com/noguerajulioces/multicarnes/commit/b0a46dae8c772ea67d4fe2897babda3fd33d6202))

## [1.6.0](https://github.com/noguerajulioces/multicarnes/compare/v1.5.0...v1.6.0) (2026-05-20)

### Features

* **008-debt-payment-types:** cash vs salary-deduction debt payments ([acdc7c4](https://github.com/noguerajulioces/multicarnes/commit/acdc7c41b8ae55555a7495ad2ac50f7080c2e6f9))

## [1.5.0](https://github.com/noguerajulioces/multicarnes/compare/v1.4.0...v1.5.0) (2026-05-15)

### Features

* **007-receipt-share:** WhatsApp / image / PDF receipt sharing ([5ae5fc7](https://github.com/noguerajulioces/multicarnes/commit/5ae5fc754e86a3e8740c1529aae49b1756c5a4bb))
* **notifications:** add per-user read state to header bell ([07a68d8](https://github.com/noguerajulioces/multicarnes/commit/07a68d87da53d08b4b7393808df5ebed31bee39c))

### Refactoring

* **NotificationBell:** streamline unseen notifications retrieval ([9120c86](https://github.com/noguerajulioces/multicarnes/commit/9120c864adefcf827aca1a8e75c43b36db970f3d))

## [1.4.0](https://github.com/noguerajulioces/multicarnes/compare/v1.3.0...v1.4.0) (2026-05-13)

### Features

* **build:** add afterSign script for ad-hoc re-signing on macOS ([8c4c37b](https://github.com/noguerajulioces/multicarnes/commit/8c4c37ba24183b261df948fe22ad4999d12e08e7))
* **caja:** refactor cash movement type handling with TYPE_META constant ([83b9ca3](https://github.com/noguerajulioces/multicarnes/commit/83b9ca35311a89123fefe33255e4aecab3e5453b))
* **card:** add card-payment processors and voucher reference ([96ae2b3](https://github.com/noguerajulioces/multicarnes/commit/96ae2b30f85171aa7575e746a88cd1ef4e10e06b))
* **promo:** add per-line Ahorro column to sale detail items table ([2840899](https://github.com/noguerajulioces/multicarnes/commit/28408999373b94a9fea26744677236697a4fb079)), closes [#N](https://github.com/noguerajulioces/multicarnes/issues/N)
* **promo:** admin sets promo, POS sells at promo price (US1 MVP) ([b267233](https://github.com/noguerajulioces/multicarnes/commit/b2672332bd0becd592cec14d3103f5899a6bcbef))
* **promo:** schedule promos with optional Desde/Hasta date range (US2) ([f5b08d0](https://github.com/noguerajulioces/multicarnes/commit/f5b08d0557a815993e44ee2429c3d117ca87c207))
* **promo:** Solo en promo filter on admin product listing (US3) ([ed6ccec](https://github.com/noguerajulioces/multicarnes/commit/ed6ccec7c33b908dfa613505b55c00ca8c8f1225))
* **promo:** surface promo on POS cards, product list, and sale detail ([de8c25d](https://github.com/noguerajulioces/multicarnes/commit/de8c25d30da15afab1804b01275befb89c4e4bf3))

### Bug Fixes

* **eslint:** update ignores to include build directory ([3109b94](https://github.com/noguerajulioces/multicarnes/commit/3109b948475525dd9a9746b0ccc550609c3a0558))
* **promo:** persist snapshotted unit_price on sale, not normal price ([d0fb8f6](https://github.com/noguerajulioces/multicarnes/commit/d0fb8f6fe31ba63501033cc5b64a827822202f3b))
* **promo:** subtotal shows list price so ahorro reads as a deduction ([31574e1](https://github.com/noguerajulioces/multicarnes/commit/31574e11778d8e8a386b9a4f8d669853162fe52d))

### Refactoring

* improve code formatting and readability across multiple files ([2606f53](https://github.com/noguerajulioces/multicarnes/commit/2606f53ca4b8420ecb425c4a11ced6c901d3d5e2))
* **promo:** reduce cart-line visual noise on promo items ([580e182](https://github.com/noguerajulioces/multicarnes/commit/580e182ba20b43445ffb5af7a23f65772dbaffb3))

### Documentation

* **promo:** add 005-promotional-pricing spec, plan, and tasks ([d5a3e02](https://github.com/noguerajulioces/multicarnes/commit/d5a3e02d6ee0075ef293d1b07e0e2a537dff0067))
* **promo:** document promotional pricing in functional-spec inventory ([0219ba3](https://github.com/noguerajulioces/multicarnes/commit/0219ba3959f72a54899b368cdd978c9d8eff963d))

### Reverts

* **promo:** drop aggregate ahorro from cart totals ([b7abe7c](https://github.com/noguerajulioces/multicarnes/commit/b7abe7ca99ba83eae81e4b49786508d4e32c2e89)), closes [#N](https://github.com/noguerajulioces/multicarnes/issues/N)

## [1.3.0](https://github.com/noguerajulioces/multicarnes/compare/v1.2.0...v1.3.0) (2026-05-12)

### Features

* **cash-movements:** add Movimientos de Caja history page (003) ([329b854](https://github.com/noguerajulioces/multicarnes/commit/329b85468edcd53f963ec531dd9bc3941bc5c9eb))
* **cash:** block logout while user has an open cash register (004) ([e6c6633](https://github.com/noguerajulioces/multicarnes/commit/e6c6633b1983f188e1b401585046c2ce0f5f8158))
* **version:** display application version in Sidebar and LoginPage ([bda0347](https://github.com/noguerajulioces/multicarnes/commit/bda03472747b940ad01ebb58f387dd04c0e3912b))

### Bug Fixes

* **cash:** cashier can register movements in their own open register ([1a395b4](https://github.com/noguerajulioces/multicarnes/commit/1a395b4cd26bc5d8f0beb8d325a956cd4158349b))
* **e2e:** close admin register before logout in sales-cancel-5-4 ([62db979](https://github.com/noguerajulioces/multicarnes/commit/62db979f69a4bd755ba5e9c2b4614e639e39c538))
* **e2e:** make logout POM wait robust to Windows CI slowdowns ([c333e35](https://github.com/noguerajulioces/multicarnes/commit/c333e35b775685130a1a3f11bb109ad656386794))
* **ui:** stock precision, receipt CTA, and mixto credit in cliente ficha ([83afe9f](https://github.com/noguerajulioces/multicarnes/commit/83afe9fa18b5fa90dac87df657ecd42289bfb206))

### Refactoring

* **reportes:** simplify JSX structure in ReportesPage component ([558f2c5](https://github.com/noguerajulioces/multicarnes/commit/558f2c5010479382288b78b6352e83b672ed3cb4))

## [1.2.0](https://github.com/noguerajulioces/multicarnes/compare/v1.1.0...v1.2.0) (2026-05-11)

### Features

* **auth:** foundational guard + US1 server-side authorization (T001-T020) ([2777705](https://github.com/noguerajulioces/multicarnes/commit/2777705144df80c6f18e74246d29a18594ce4138))
* **auth:** US2 server-side authorization for financial mutations (T022-T029) ([51c33fc](https://github.com/noguerajulioces/multicarnes/commit/51c33fc2fe3caa103980d4c00bbc73aef757c42f))
* **auth:** US3 cost-data gating for cashiers (T031-T037) ([3561d00](https://github.com/noguerajulioces/multicarnes/commit/3561d00895a0b4f017b2fd955d11e649090f627c))
* **auth:** US4 audit + alerts surfacing on dashboard (T039-T047) ([458e514](https://github.com/noguerajulioces/multicarnes/commit/458e514ef0a60502a3974362f1935c35f1d32d3b))
* **auth:** US5 recovery path on the login screen (T049-T054) ([10893c1](https://github.com/noguerajulioces/multicarnes/commit/10893c1899ac85e843c8076883aeb59cf3f7635c))
* **db:** versioned migrations with schema_migrations ledger (P3) ([8e08406](https://github.com/noguerajulioces/multicarnes/commit/8e084060e40a44cafeb691ab9f0280ae8848d8eb))
* enhance ticket rendering with emphasized parts for better layout ([398b97d](https://github.com/noguerajulioces/multicarnes/commit/398b97dcf9b7fb12f6765f07c5eeca8a8e4f546c))
* **held-tickets:** persist held tickets in SQLite instead of localStorage (P9) ([f4a1575](https://github.com/noguerajulioces/multicarnes/commit/f4a1575f6e39182a32bbbcaf3bcb5f68188df3b7))
* **round-2:** scope held tickets per cashier, fix purchase audit attribution, mixed-payment cancellation prompt ([e45810f](https://github.com/noguerajulioces/multicarnes/commit/e45810f8acf3a7d8ffec653ccc91140d716910b7))
* **sales:** validate cash register is open before creating a sale (P2) ([a8b8562](https://github.com/noguerajulioces/multicarnes/commit/a8b85629a656a0a705150047a47927311682156d))
* **stock:** write stock_adjustments rows for sales and purchase receptions (P5) ([9f84daa](https://github.com/noguerajulioces/multicarnes/commit/9f84daae140deed2130fee29d53baa12f74d1469))
* **updater:** in-app auto-update via electron-updater + GitHub Releases ([cce732c](https://github.com/noguerajulioces/multicarnes/commit/cce732c7a9900b3b6c434cad46442a53a0402a18))
* **ventas:** server-side pagination for /ventas listing ([4382877](https://github.com/noguerajulioces/multicarnes/commit/43828770aa87d35d6c9602fc022b6ee0294d5fdb))

### Bug Fixes

* **e2e:** update Excel export test description and rationale for manual QA ([619e099](https://github.com/noguerajulioces/multicarnes/commit/619e0995e73bf87f8f74f629805a7fc8e2376468))
* **main:** guard splash + main-window timers against destroyed window ([5c5643c](https://github.com/noguerajulioces/multicarnes/commit/5c5643c2f9b13b53d282ed6a7fa2faf9047facb1))

### Refactoring

* **ticket:** update ticket width calculation to use character units ([cbde6bb](https://github.com/noguerajulioces/multicarnes/commit/cbde6bb41aa6ad3ea658ff0e4fc1a02bdf90708d))

### Documentation

* close out 001-ipc-authorization Polish phase (T060-T062) ([0945986](https://github.com/noguerajulioces/multicarnes/commit/0945986207b9c384fa27f2c3842d1428c16cb82b))
* **constitution:** track P7+P8 progress on tasks.md (constitution updates landed in .specify/, gitignored) ([1765d26](https://github.com/noguerajulioces/multicarnes/commit/1765d2627bd8630b8a650bd66ca10754d4be603e))
* **sales:** flag mixed-credit cancellation divergence and update task progress (P6) ([aa9d31f](https://github.com/noguerajulioces/multicarnes/commit/aa9d31fa09a164c30ac0739c21fe4c44881c90aa))
* **specs:** add 001-ipc-authorization spec and round-2 gap-analysis tasks ([e33eaeb](https://github.com/noguerajulioces/multicarnes/commit/e33eaeb57b9d8efe7e8fb0b9281ef1596d5315c4))

## 1.1.0 (2026-05-04)

### Features

* add CI workflow for linting, typechecking, and building the project ([83b6788](https://github.com/noguerajulioces/multicarnes/commit/83b67886fb1beb25f030ef63413c1c16576a9176))
* add confirmation dialog for opening cash drawer with zero initial amount ([43491a9](https://github.com/noguerajulioces/multicarnes/commit/43491a941419ce6f4828d4827066e4e7b95ec064))
* add filtering options for product status and enhance filter functionality in ProductosPage ([44c8175](https://github.com/noguerajulioces/multicarnes/commit/44c81758830d02422e77d9d8f9dc8f55a58c630f))
* add guided tours to various pages and components ([73e6506](https://github.com/noguerajulioces/multicarnes/commit/73e6506ff81653eb09b60482fd2263faf84a21dd))
* add image upload functionality in ProductoFormPage and IPC handlers ([06933b8](https://github.com/noguerajulioces/multicarnes/commit/06933b8710848a68946c42474fb24e9ec65c393a))
* add KpiCard and PageHeader components, enhance Caja and CierreCaja pages with new UI elements ([1c873c5](https://github.com/noguerajulioces/multicarnes/commit/1c873c58da3ed889824058132e64abbf12c4d5ef))
* add MoneyInput component and integrate it into Caja and CierreCaja pages for improved monetary input handling ([6dee67c](https://github.com/noguerajulioces/multicarnes/commit/6dee67c2a2e19fca6d6fda01419411fbb0444dc0))
* add pending credits and sales summary reports with IPC integration ([5c9ee0b](https://github.com/noguerajulioces/multicarnes/commit/5c9ee0b38779deeb172c0bdeb1a583b6ae6ca525))
* add product detail page and enhance product-related IPC handlers with stock movements, recent sales, sales stats, and last purchase functionalities ([637d4b3](https://github.com/noguerajulioces/multicarnes/commit/637d4b3589919e4264c580e80bc470b2cae78c0f))
* add release workflow and configuration for automated GitHub releases ([94878b2](https://github.com/noguerajulioces/multicarnes/commit/94878b209c33f08f2b54e232aeb4961a461608ce))
* add technical documentation for project structure and database schema ([03635a7](https://github.com/noguerajulioces/multicarnes/commit/03635a7e2b265c215882de802e9e681965013bb9))
* add TourButton component and implement page tour functionality in Dashboard and Ventas pages ([5e60375](https://github.com/noguerajulioces/multicarnes/commit/5e603756ce3f9c4f72e5e8acaa859ab87f83028f))
* add user profile page with PIN change functionality and update routing ([50eb507](https://github.com/noguerajulioces/multicarnes/commit/50eb5073400fb3ea5f074397de5652ee3f8c5a0b))
* enforce 6-digit PIN validation across user-related functionalities and update UI accordingly ([ccfaae9](https://github.com/noguerajulioces/multicarnes/commit/ccfaae989aa10821c483c726bc7aabf284aa99c4))
* enhance BackupPage and ConfiguracionPage with improved UI layout and components ([b0fd08f](https://github.com/noguerajulioces/multicarnes/commit/b0fd08f3cb380dd0cfb44e84c1862fa6a3b17279))
* enhance cash management and add self-service profile with receipt rendering pipeline ([bdfe09c](https://github.com/noguerajulioces/multicarnes/commit/bdfe09c71203e17a1e19791a1da49880bf301e68))
* enhance ClienteFichaPage and ClientesPage with improved UI components and payment handling ([818f0c1](https://github.com/noguerajulioces/multicarnes/commit/818f0c1373ef16fc5223d8289bcb27954d54c66d))
* enhance CobroModal and VentasPage with improved payment handling and UI updates ([4632f8a](https://github.com/noguerajulioces/multicarnes/commit/4632f8abc9959aa8982127e2f21ce8d73100548f))
* enhance ConfiguracionPage with improved UI components, settings management, and theme options ([05bc4a7](https://github.com/noguerajulioces/multicarnes/commit/05bc4a7af9b90156aab98fd4b926e47ebf51eead))
* enhance customer management with document and document type fields, update queries and UI components ([5a601b1](https://github.com/noguerajulioces/multicarnes/commit/5a601b11158bcf0f272b495b65aa951dcbe4f35c))
* enhance customer retrieval with employee filtering; update related types and UI components ([6fb6f3a](https://github.com/noguerajulioces/multicarnes/commit/6fb6f3a604555d1b72350fdebac23846969c1252))
* enhance dashboard with new components and user avatar in header ([c950bab](https://github.com/noguerajulioces/multicarnes/commit/c950bab2e7792fa089cf2a645cd010b834d11dee))
* enhance DashboardPage for user role-based data loading and display ([a6792ac](https://github.com/noguerajulioces/multicarnes/commit/a6792acb7ada9c162ddd7e2c7d1d87206ed8332c))
* enhance Header component with notification system and improve layout ([7d111e8](https://github.com/noguerajulioces/multicarnes/commit/7d111e80a1f288510136f6bd2336ebf654a3d626))
* enhance layout of ProductoFormPage with improved image upload section and responsive design ([a28b1b6](https://github.com/noguerajulioces/multicarnes/commit/a28b1b6744c64c6e4f9036624e1d2a977aff5320))
* enhance PerfilPage with user profile fetching and date formatting ([678e9c2](https://github.com/noguerajulioces/multicarnes/commit/678e9c2ce1eb1cc09538dd94c778be2bf2d7398e))
* enhance PosScreen and VentasPage with navigation and UI improvements for cash management ([40a88eb](https://github.com/noguerajulioces/multicarnes/commit/40a88eb0e80cd812fcb01fe57feeb672397229ab))
* enhance print functionality with error handling and printer configuration check ([cef6535](https://github.com/noguerajulioces/multicarnes/commit/cef653575e1e06e6bdd58fa28206d8ed4e4d247b))
* enhance ProductoFormPage and ProductosPage with improved UI components and stock management features ([5092685](https://github.com/noguerajulioces/multicarnes/commit/50926857396f17a961ae131dbc3666eae66d6f80))
* enhance ProductoFormPage to navigate after saving product data ([a232c44](https://github.com/noguerajulioces/multicarnes/commit/a232c449cd2cccd4820ea63711b7bafd75476a4a))
* enhance ProductosPage with product image display and improved stock indicators ([e9276f7](https://github.com/noguerajulioces/multicarnes/commit/e9276f775aec8c810c75835d9517ad39bf89ec9d))
* enhance splash screen with fade-out effect and minimum display time ([c286072](https://github.com/noguerajulioces/multicarnes/commit/c286072585678e4f3d0938fb972b56fcc15db6ab))
* enhance UsuariosPage with improved UI components, form handling, and user management features ([1cfefda](https://github.com/noguerajulioces/multicarnes/commit/1cfefdafde6d1a244b737a91df997762d8b38a7a))
* extend price types and update related database schema; enhance product handling in UI components ([bd1fef7](https://github.com/noguerajulioces/multicarnes/commit/bd1fef731bf2ba3ed2d4c4c889a7f31a4be9d41f))
* implement balance code parser and enhance VentasPage with held ticket functionality ([e7da202](https://github.com/noguerajulioces/multicarnes/commit/e7da202ce431b9dc67381bdd8c3eb591a52c2dfa))
* implement dashboard and ventas tours with respective steps and triggers ([d23698b](https://github.com/noguerajulioces/multicarnes/commit/d23698b648852e0a4e65e25313d2e560a8cf53f1))
* implement infinite scrolling for product loading in VentasPage; add loading state and total products tracking ([daf5a88](https://github.com/noguerajulioces/multicarnes/commit/daf5a8882088daf2be0b47afad70f6f752288008))
* implement pagination for customers, products, suppliers, and purchases; update related queries and IPC handlers ([b56f251](https://github.com/noguerajulioces/multicarnes/commit/b56f2518cb3fc43354c09e012cbfa35f5ac361f5))
* implement PosScreen component and update routing for sales functionality ([323f42a](https://github.com/noguerajulioces/multicarnes/commit/323f42a0e086811101b4374bf252feea756eebf1))
* implement splash screen with fade-in and fade-out animations ([50dc782](https://github.com/noguerajulioces/multicarnes/commit/50dc782dadc013df97262b3c4badc78c477ae032))
* implement ticket printing and PDF download functionality ([9b55e19](https://github.com/noguerajulioces/multicarnes/commit/9b55e19433888963d48f22c390583d078699e3c3))
* integrate tour functionality with [@reactour](https://github.com/reactour) and add ventas tour steps ([0a542c7](https://github.com/noguerajulioces/multicarnes/commit/0a542c72512df4caa0d418446433fd8c3526f183))
* refactor Sidebar component to improve navigation structure and user experience ([c45b22e](https://github.com/noguerajulioces/multicarnes/commit/c45b22e0ad71cd33370e5f9e33961f78552a21a9))
* update application icons for Windows and macOS, and adjust icon handling in main process ([8a558c0](https://github.com/noguerajulioces/multicarnes/commit/8a558c06142c4ee2ddb998985606c1c8ddf72206))
* update package.json with project details and add application icon ([28fb111](https://github.com/noguerajulioces/multicarnes/commit/28fb111538ff0fed3fc80af7086cafef023f6c23))
* update README with detailed project description, features, tech stack, and installation instructions ([8124d0d](https://github.com/noguerajulioces/multicarnes/commit/8124d0d3645284472dabbff640a162b94bf61257))
* update ReportesPage to use first day of the month as default date and enhance utils with new date formatting function ([7e11b15](https://github.com/noguerajulioces/multicarnes/commit/7e11b15bbba1d14e1734061589c3c62f3ce17da1))
* update routing and navigation for Proveedores page ([6f79ab3](https://github.com/noguerajulioces/multicarnes/commit/6f79ab37649f08944d83b99f1ef8d22024433232))
* update UI components and improve user experience across multiple pages ([152acac](https://github.com/noguerajulioces/multicarnes/commit/152acacb840b380c88af044d3ed2edf9be0d569b))

### Bug Fixes

* set PDF export orientation to portrait regardless of column count ([f3088c4](https://github.com/noguerajulioces/multicarnes/commit/f3088c443444d41f5c3f965445239c8460a465c8))

### Refactoring

* enhance ComprasPage with improved UI components and status filtering ([6cd8950](https://github.com/noguerajulioces/multicarnes/commit/6cd8950870bc6b86bcb4bc3168f991b3c150d197))
