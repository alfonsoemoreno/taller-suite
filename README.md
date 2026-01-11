# Taller Suite

Suite de gestion de taller (ordenes de trabajo, clientes, vehiculos, inventario y pagos) construida en Next.js (App Router) con API Routes y un paquete compartido de tipos/validaciones.

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
packages/
  shared/         # Tipos y utilidades compartidas
```

## Stack

- Backend: Next.js API Routes, Prisma, PostgreSQL, Auth.js, Zod
- Frontend: React, Next.js App Router, MUI, Emotion
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

- `.env`

3) Levanta todo en modo desarrollo:

```bash
npm run dev
```

Opcionales:

## Variables de entorno
```
DATABASE_URL=
SHADOW_DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
NEON_AUTH_ISSUER=
NEON_AUTH_CLIENT_ID=
NEON_AUTH_CLIENT_SECRET=
GETAPI_KEY=
NEXT_PUBLIC_API_BASE_URL=/api
```

## Base de datos y Prisma

El esquema vive en `prisma/schema.prisma` y modela entidades como:

- usuarios y autenticacion por roles
- clientes y vehiculos
- ordenes de trabajo, items y notas
- pagos y cierres de caja
- catalogo e inventario (movimientos y stock)
- compras y proveedores

Si necesitas correr migraciones o generar el cliente:

```bash
npx prisma migrate dev --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
```

## Scripts

### Raiz

- `npm run dev`: build de `@taller/shared` + Next.js dev server
- `npm run build`: build de todos los workspaces
- `npm run lint`: lint de todos los workspaces

- `npm run dev`: Next.js dev server
- `npm run build`: build de Next.js
- `npm run start`: ejecutar build

### Shared (`packages/shared`)

- `npm run build`: compila a `dist/`

## Paquete compartido

`@taller/shared` expone tipos y utilidades usados por la API y el frontend. Se compila a `packages/shared/dist` y se importa como dependencia normal en ambos apps.

## Tests y calidad

- Lint global: `npm run lint`
- Tests API: pendientes

## Deploy

Build completo:

```bash
npm run build
```

Luego:

- Web/API: `npm run start`
## Estructura
