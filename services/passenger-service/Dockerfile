# Use an official lightweight Node runtime
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files first to leverage Docker's caching mechanism
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the internal port the service runs on
EXPOSE 3001

# The command to start our app
CMD ["npm", "run", "dev"]