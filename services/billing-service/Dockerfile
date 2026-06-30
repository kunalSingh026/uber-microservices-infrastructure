FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# FIX: Change from 3002 to 3003 to match your Billing Service port
EXPOSE 3003 
CMD ["npm", "run", "dev"]