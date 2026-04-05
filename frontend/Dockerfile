FROM node:20-alpine
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./frontend/
WORKDIR /app/frontend
RUN npm install
COPY frontend/ .
EXPOSE 5173
CMD ["npm", "run", "dev"]
