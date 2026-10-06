# adm-backend

API del sistema de administración para mipymes (ventas, inventario, nómina,
estructura de empresa). El cliente es `../adm-frontend`.

## Stack

- NestJS 11, GraphQL con Apollo en modo _schema-first_ (archivos `*.graphql`
  junto a cada módulo), TypeORM sobre PostgreSQL.
- Redis para la caché (sesiones activas) y para las suscripciones GraphQL.
- Node **20.18.3** exacto (`engines` en `package.json`).

## Arrancar en local

1. PostgreSQL en `localhost:5432` con la base `adm` y Redis en `localhost:6379`.
   En esta máquina Redis se instaló con Scoop y no corre como servicio: hay que
   lanzar `redis-server` antes del backend.
2. `.env` en la raíz (no se versiona). Las variables obligatorias están en
   `src/common/config/environment-variables.ts`: `TYPEORM_*`,
   `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `CORS_ORIGIN`, `NODE_ENV`,
   `PORT`, `CACHE_REDIS_*`, `SUBSCRIPTION_REDIS_*`.
3. `npm run start:dev` → `http://localhost:3000/graphql`. Las migraciones se
   ejecutan solas al iniciar (`migrationsRun: true`).

Otros comandos: `npm run build`, `npm run lint`,
`npm run migration:generate --name=Nombre`, `npm run migration:revert`.

## Despliegue

**Cada `push` a la rama `main` se despliega solo en producción**: Heroku está
conectado al repositorio de GitHub (app `adm-backend`,
`adm-backend-8ed317c515c9.herokuapp.com`). Arranca con `Procfile`
(`npm run start:prod`), compila en `postinstall` y aplica las migraciones
pendientes al iniciar. Cualquier otra rama no despliega.

## Estructura

- `src/common/`: configuración, base de datos, GraphQL, caché, logger.
- `src/core/`: entidades y servicio base, errores, operaciones remotas de
  listado (filtros, orden, paginación).
- `src/modules/`: un módulo por dominio (`auth`, `users`, `company`,
  `inventory`, `payroll`, `sales`, `email`, `telegram`, `notification`...).
- `src/migrations/`: migraciones de TypeORM. El esquema solo cambia por aquí
  (`synchronize: false`).

## Configuración en dos niveles

`ConfigService.get()` busca primero en la tabla `config` (grupos editables
desde el frontend) y después en el `.env`. Ahí viven, en **segundos**,
`ACCESS_TOKEN_EXPIRE_IN` (300), `REFRESH_TOKEN_EXPIRE_IN` (14400) y
`CONFIRMATION_TOKEN_EXPIRE_IN` (360000), además de `FRONTEND_CHANGE_PASSWORD_URL`
y la configuración de correo.

## Autenticación (`src/modules/auth`)

- **Cookies** `Authorization` (acceso) y `Refresh`, `HttpOnly; Secure;
  SameSite=None`. Para borrarlas hay que usar los mismos atributos
  (`AuthService.clearAuthCookies`); sin ellos el navegador ignora el borrado.
- **Sesión única**: los tokens de acceso válidos de cada usuario se guardan en
  Redis (`AccessTokenUser{id}`). Un login nuevo invalida el anterior.
- **Refresh token**: en la base de datos solo se guarda su SHA-256
  (`helpers/token-hash.helper.ts`; bcrypt no sirve porque trunca a 72 bytes).
  Rota en cada `refresh` (`AuthService.issueRefreshToken`) y el token anterior
  sigue valiendo 30 s para peticiones que ya iban en camino.
- Cada JWT lleva `jti`, así dos tokens emitidos en el mismo segundo no coinciden.
- **2FA (TOTP)**: `isTwoFactorEnabled` significa que la cuenta lo exige e
  `isTwoFactorConfigured` que ya emparejó un dispositivo.
  - `generate2faSecret` guarda el secreto sin exigir nada todavía;
    `finishConfigure2FA` lo confirma y activa; `verify2FA` emite los tokens con
    `twoFactorAuthPassed`.
  - El usuario puede desactivarla con `disableOwn2FA` (pide un código).
  - `enable2FA`, `disable2FA` y `reset2FASettings` son de administrador y
    requieren rol SUPER (`AccessTokenAuthGuard` + `RoleGuard`).
  - Las operaciones marcadas con `@NotProtectByTwoFactorAuth()` funcionan con el
    segundo factor pendiente; el resto responde
    `401 Two-factor authentication required`.
- **Recuperar contraseña**: `requestPasswordChange` responde siempre lo mismo
  (no revela si el correo existe) y sustituye el enlace activo anterior;
  `changePassword` consume el enlace y anula el refresh token del usuario.
- **Cambiar contraseña**: cada usuario cambia la suya con `changeOwnPassword`,
  que exige la contraseña actual y un mínimo de 8 caracteres.
  `changePasswordByEmail` fija la de otro usuario sin conocerla y es solo para
  SUPER.
- **Perfil propio**: `updateUserProfile` valida con su propio DTO (nombre de 3
  caracteres o más, teléfono internacional, apellidos opcionales: una cadena
  vacía los borra).
- El usuario `system@admin.com` lo crean las migraciones, no tiene contraseña y
  no puede cambiarla. El primer usuario real se crea con `createFirstUser`
  (pantalla `/cfu` del frontend).

## Estadísticas (`src/modules/statistics`)

Consultas de solo lectura `dashboardStatistics` y `salesStatistics`, calculadas
en la base de datos con SQL directo (`StatisticsService`).

- **Ingreso** = ventas `CONFIRMED` o `PARTIALLY_REFUNDED`, por
  `effectiveDate` (o `createdAt` si falta). Las devueltas por completo, las
  canceladas y los borradores no suman.
- **Monedas**: nunca se suman importes de monedas distintas. Cada consulta
  informa en una moneda (`currency`; por defecto la más usada) y devuelve la
  lista de monedas con ventas.
- **Alcance**: SUPER ve todo (puede filtrar por empresa); los demás roles solo
  su empresa, oficina, departamento o equipo, tomados del token.
- **Días**: el periodo llega como días de calendario del usuario
  (`YYYY-MM-DD`) más su desfase horario; se agrupa por día hasta 92 días y por
  mes en periodos más largos.
- El importe por producto usa el precio base guardado en cada línea
  (`productPaymentOptions`), porque el detalle de venta no guarda el precio
  cobrado.

## Ventas (`src/modules/sales`)

- **Estados** (`saleStatus`): `DRAFT` reserva existencias; `CONFIRMED` está
  cobrada; `CANCELLED` soltó su reserva; `PARTIALLY_REFUNDED` y
  `FULLY_REFUNDED` devolvieron productos al inventario. Una venta cobrada no se
  cancela ni se elimina: se devuelve (`refundSale`).
- **Vender**: `createSale` crea la venta con sus líneas y, si llegan
  `payments`, la cobra en la misma transacción. Sin pagos queda en borrador y
  se cobra con `makeSale`. `saleCatalog` da a la pantalla de venta todo lo de
  la tienda en una consulta y `quoteSale` el precio de un carrito sin guardarlo.
- **Precios por moneda** (`sale/helpers/sale-payments.helper.ts`): cada línea
  guarda su precio en cada moneda (`productPaymentOptions`). Un pago cubre la
  fracción `importe / precio en su moneda`, así se cobra parte en una moneda y
  parte en otra. `unitPrice`, `subtotal` y `currency` de una línea, y el total
  de un borrador, se calculan al leer: no son columnas.
- **Alcance** (`sale/helpers/sale-scopes.ts`): ventas y clientes son de la
  tienda (empresa + oficina). Un vendedor sin mando solo ve sus ventas.
- **Clientes**: teléfono, correo y carné no se repiten dentro de una empresa.
  Eliminar un cliente conserva sus ventas.
- **Mensajería**: una venta con `hasDelivery` no se cobra sin mensajero.
- El listado de ventas carga aparte los usuarios de vendedor y mensajero: el
  constructor de consultas usa como alias el último tramo de la relación, y
  dos relaciones `*.user` chocan.

## Convenciones y trampas

- Los errores de negocio extienden `AppError` (`src/core/errors`) y llegan al
  cliente como `{ message, extensions: { code } }` con el código HTTP como
  texto (`"401"`, `"404"`...). El frontend decide por `code` y `message`.
- Un `@Roles(...)` sin `RoleGuard` en `@UseGuards` no se aplica.
- `cacheManager.set(clave, valor, ttl)` ignora el TTL numérico con este store
  de Redis; hay que pasar `{ ttl: segundos }`.
- `npm run lint` muestra miles de `Delete ␍` por los finales de línea CRLF del
  checkout en Windows; es ruido, no errores del código.
- En modo _watch_ el arranque puede fallar una vez con `EPERM ... rmdir dist`;
  basta con relanzarlo.
- La carpeta `.claude/` y `dump.rdb` (volcado local de Redis) no se versionan.

## Pendiente

- Configurar el proveedor de correo; sin él no se envían los enlaces de
  contraseña ni los avisos de alta.
- `FRONTEND_CHANGE_PASSWORD_URL` debe apuntar a `<frontend>/#/change-password`
  (el frontend usa rutas con `#`).
- El emisor que muestra la aplicación de autenticación está fijo como
  `GoldenSoft` en `AuthService.generate2FASecret`.
- Los intentos de código 2FA no tienen límite.
