# Unit Tests & Docker Setup

## Running Tests

### Install Test Dependencies
```bash
npm install --save-dev jest supertest
```

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Specific Test Suite
```bash
npm test -- auth.service.test.js
```

### Watch Mode (for development)
```bash
npm test -- --watch
```

## Test Files Location
All tests are in `server/__tests__/` directory with `.test.js` extension.

## Coverage Goals
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

---

# Docker Configuration

## Docker Setup

The `Dockerfile` and `docker-compose.yml` files enable containerized deployment.

### Prerequisites
- Docker installed
- Docker Compose installed

### Build and Run

```bash
# Build the Docker image
docker build -t poketstar-pos:latest .

# Run with docker-compose
docker-compose up
```

### Services in Docker Compose
- **POS App**: Node.js server on port 4000
- **MongoDB**: Database on port 27017 (optional)
- **PostgreSQL**: Database on port 5432 (optional)
- **Redis**: Cache on port 6379 (optional)

### Environment Variables
Create `.env.docker` for Docker-specific configuration:
```env
NODE_ENV=production
PORT=4000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=poketstar_pos
DB_USER=postgres
DB_PASSWORD=postgres
```

### Production Deployment

```bash
# Using docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Or using Kubernetes
kubectl apply -f k8s/deployment.yaml
```

---

# CI/CD Pipeline

GitHub Actions workflow for automated testing and deployment.

### Workflow Steps
1. **Install Dependencies**: `npm install`
2. **Lint Code**: `npm run lint`
3. **Run Tests**: `npm test`
4. **Build Docker Image**: `docker build`
5. **Push to Registry**: Push to Docker Hub/AWS ECR
6. **Deploy**: Auto-deploy to staging/production

### GitHub Secrets Required
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub access token
- `AWS_ACCESS_KEY_ID`: AWS credentials
- `AWS_SECRET_ACCESS_KEY`: AWS credentials

---

# Database Migration

### MongoDB Migration
```bash
npm install mongoose
node server/models/mongodb.models.js
```

### PostgreSQL Migration
```bash
npm install pg sequelize
node scripts/migrate-postgres.js
```

---

# Monitoring & Logging

- **Application Logs**: `logs/app.log`
- **Error Logs**: `logs/error.log`
- **Access Logs**: `logs/access.log`

### View Logs
```bash
docker logs poketstar-pos
```
