FROM node:20.19.5-alpine

RUN node --version && npm --version

WORKDIR /app

# Full monorepo (mockifyer-web depends on file:../packages/*)
COPY . ./

# Build shared packages first (required before mockifyer-web can load them)
RUN sh packages/build-all.sh

# Web app (has npm start → node dist/index.js)
WORKDIR /app/mockifyer-web
RUN npm install

EXPOSE 3000

CMD ["npm", "start"]
