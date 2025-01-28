FROM node:22-bullseye-slim

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

COPY ./ ./
RUN yarn build

CMD ["npm", "start"]
