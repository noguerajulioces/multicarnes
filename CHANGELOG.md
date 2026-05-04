# Changelog

All notable changes to this project are documented here. The format follows [Conventional Commits](https://www.conventionalcommits.org/) and [Semantic Versioning](https://semver.org/).

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
