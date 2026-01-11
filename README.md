# Taller Suite

Monorepo para una suite de gestion de taller (ordenes de trabajo, clientes, vehiculos, inventario y pagos) con API en NestJS y frontend React. Usa npm workspaces y un paquete compartido para tipos/validaciones.

## Contenido

- [Estructura](#estructura)
- [Stack](#stack)
- [Requisitos](#requisitos)
- [Inicio rapido](#inicio-rapido)
- [Variables de entorno](#variables-de-entorno)
- [Base de datos y Prisma](#base-de-datos-y-prisma)
- [Scripts](#scripts)
- [Paquete compartido](#paquete-compartido)
- [Tests y calidad](#tests-y-calidad)
- [Deploy](#deploy)

## Estructura

```
apps/
  api/            # API NestJS
  web/            # Frontend React + Vite
packages/
  shared/         # Tipos y utilidades compartidas
```

## Stack

- Backend: NestJS, Prisma, PostgreSQL, JWT, Zod
- Frontend: React, Vite, React Router, MUI, Emotion
- Monorepo: npm workspaces

## Requisitos

- Node.js y npm
- PostgreSQL para el entorno local o remoto

## Inicio rapido

1) Instala dependencias en la raiz:

```bash
npm install
```

2) Configura variables de entorno:

- `apps/api/.env`
- `apps/web/.env`

3) Levanta todo en modo desarrollo:

```bash
npm run dev
```

Opcionales:

```bash
npm run dev:api
npm run dev:web
```

## Variables de entorno

### API (`apps/api/.env`)

```
DATABASE_URL=
SHADOW_DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
BCRYPT_SALT_ROUNDS=10
FRONTEND_URL=http://localhost:5173
GETAPI_KEY=
```

### Web (`apps/web/.env`)

```
VITE_API_BASE_URL=http://localhost:3000
```

## Base de datos y Prisma

El esquema vive en `apps/api/prisma/schema.prisma` y modela entidades como:

- usuarios y autenticacion por roles
- clientes y vehiculos
- ordenes de trabajo, items y notas
- pagos y cierres de caja
- catalogo e inventario (movimientos y stock)
- compras y proveedores

Si necesitas correr migraciones o generar el cliente:

```bash
npx prisma migrate dev --schema apps/api/prisma/schema.prisma
npx prisma generate --schema apps/api/prisma/schema.prisma
```

## Scripts

### Raiz

- `npm run dev`: build de `@taller/shared` + API y Web en paralelo
- `npm run dev:api`: API en dev
- `npm run dev:web`: Web en dev
- `npm run build`: build de todos los workspaces
- `npm run lint`: lint de todos los workspaces

### API (`apps/api`)

- `npm run dev`: API en watch mode (incluye build de shared)
- `npm run build`: build de NestJS
- `npm run start:prod`: ejecutar build
- `npm run test`: Jest

### Web (`apps/web`)

- `npm run dev`: Vite dev server
- `npm run build`: build de TypeScript + Vite
- `npm run preview`: previsualizar build

### Shared (`packages/shared`)

- `npm run build`: compila a `dist/`

## Paquete compartido

`@taller/shared` expone tipos y utilidades usados por la API y el frontend. Se compila a `packages/shared/dist` y se importa como dependencia normal en ambos apps.

## Tests y calidad

- Lint global: `npm run lint`
- Tests API: `npm run test -w apps/api`

## Deploy

Build completo:

```bash
npm run build
```

Luego:

- API: `npm run start:prod -w apps/api`
- Web: servir `apps/web/dist` con tu servidor estatico preferido
## Estructura
