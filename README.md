# Facilita

Plataforma educacional **multi-tenant**: cada instituição tem seu próprio espaço, marca e financeiro, com cursos, avaliações, certificados e aulas ao vivo.

## Funcionalidades

- **Multi-tenant** com branding por instituição (logo, cores, textos de login)
- **Cursos** gratuitos e pagos, com controle de acesso
- **Avaliações** e emissão de **certificados**
- **Aulas ao vivo** com LiveKit
- **Ciclo acadêmico** e workspace da instituição
- **Financeiro**: mensalidades, reajustes, faturas e histórico de eventos
- **Planos e assinaturas** da plataforma (modelo por faixas)
- Captura de **leads** e **notificações**

## Stack

| Camada | Tecnologias |
|---|---|
| Frontend | React, TypeScript, LiveKit Components, Axios, Lucide |
| Backend | Node.js, Express, TypeScript, Prisma, JWT, Multer |
| Banco | PostgreSQL (migrations versionadas com Prisma) |
| Infra | Docker, LiveKit |

## Estrutura

```
backend/
├── prisma/          # schema e migrations
├── src/
│   ├── assessments/        certificates/     commerce/
│   ├── institution/        institution-finance/
│   ├── platform/           platform-finance/
│   ├── live/               notifications/    middleware/
└── tests/
frontend/
├── src/ (api, auth, components, context, pages, types)
└── tests/
docs/                # decisões de design (financeiro, ciclo acadêmico, aulas ao vivo...)
ops/livekit-pilot/   # infraestrutura do piloto de aulas ao vivo
```

## Rodando localmente

```bash
# backend
cd backend
cp .env.example .env   # configure DATABASE_URL e JWT
npm install
npx prisma migrate dev
npm run dev

# frontend
cd ../frontend
npm install
npm run dev
```

## Documentação

As decisões de arquitetura e regras de negócio estão em [`docs/`](./docs).

---

Desenvolvido por [João Victor](https://github.com/srjuao) · Pier Dev
