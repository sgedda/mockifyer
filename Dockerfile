FROM node:20-alpine

WORKDIR /app

# Copy files (if Root Directory is set to example-projects/express-api-mock, 
# the build context is already that directory, so we copy from .)
# If Root Directory is root, we'd need example-projects/express-api-mock/ but
# Railway with Root Directory set means context is already the subdirectory
COPY . ./

# Verify source files exist
RUN ls -la package*.json || (echo "ERROR: package files not found!" && exit 1)

# Copy production package files
RUN cp package.prod.json package.json && \
    cp package-lock.prod.json package-lock.json

# Verify copied files exist
RUN ls -la package.json package-lock.json || (echo "ERROR: package files not copied!" && exit 1)

# Install dependencies
RUN npm install --verbose

# Build the application
RUN npm run build

# Verify Node.js version (for debugging)
RUN node --version && npm --version

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

