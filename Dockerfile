FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# Dependências primeiro, para o cache do Docker aproveitar quando só o código muda.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY db ./db

# Usuário sem privilégio. A pasta de dados é montada por fora e precisa pertencer a ele.
RUN mkdir -p /dados/acervo && chown -R node:node /app /dados
USER node

EXPOSE 3000

# Node 22 lê TypeScript direto, sem passo de compilação.
CMD ["node", "--experimental-strip-types", "src/server.ts"]
