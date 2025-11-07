FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S miyabi -u 1001

# Change ownership
RUN chown -R miyabi:nodejs /app
USER miyabi

# Expose port (if needed for health checks)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]