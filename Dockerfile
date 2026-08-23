FROM node:20-alpine
WORKDIR /usr/src/app

# Copy dependency files
COPY package*.json ./
# Step 4: Install production dependencies
RUN npm ci --only=production

# Copy the rest of your code and build the Next.js site
COPY . .
RUN npm run build

# Expose the default Next.js port
EXPOSE 3000

# The CMD you need
CMD ["npm", "start"]
