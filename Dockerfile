FROM node:20-alpine

# Verify Node.js version (for debugging) - do this early so we see it even if build fails
RUN node --version && npm --version

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

# Check lockfile version and verify it's valid JSON
RUN echo "=== Checking lockfile ===" && \
    head -10 package-lock.json && \
    echo "---" && \
    node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package-lock.json', 'utf8')); console.log('lockfileVersion:', pkg.lockfileVersion); console.log('Valid JSON: YES');" && \
    echo "=== Current directory ===" && \
    pwd && \
    echo "=== Files in current directory ===" && \
    ls -la

# Install dependencies
# npm ci is failing despite valid lockfile - try with verbose output first
RUN npm ci --verbose 2>&1 || (echo "=== npm ci failed, checking npm debug log ===" && cat /root/.npm/_logs/*-debug-0.log 2>/dev/null || echo "No debug log found" && echo "=== Trying npm install as fallback ===" && npm install)

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

