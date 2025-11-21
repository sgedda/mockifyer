FROM node:18-alpine

WORKDIR /app

# Copy only the example project
COPY example-projects/express-api-mock/ ./

# Copy production package files
RUN cp package.prod.json package.json && \
    cp package-lock.prod.json package-lock.json

# Install dependencies
RUN npm ci

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

