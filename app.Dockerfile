FROM node:latest
WORKDIR /usr/social_media/
COPY package*.json ./

RUN npm ci --omit=dev
COPY . .
EXPOSE 4000
CMD ["node", "app.js"]
