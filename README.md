# AGNI GUARD — IoT Wildfire Detection System
### DevOps Implementation

[![CI](https://github.com/Isuru-Darshana/agni-dev/actions/workflows/ci.yml/badge.svg)](https://github.com/Isuru-Darshana/agni-dev/actions/workflows/ci.yml)
[![Security](https://github.com/Isuru-Darshana/agni-dev/actions/workflows/security.yml/badge.svg)](https://github.com/Isuru-Darshana/agni-dev/actions/workflows/security.yml)
[![Deploy](https://github.com/Isuru-Darshana/agni-dev/actions/workflows/deploy.yml/badge.svg)](https://github.com/Isuru-Darshana/agni-dev/actions/workflows/deploy.yml)

A multi-sensor IoT wildfire early detection system deployed for the Knuckles Conservation Forest, Sri Lanka. This repository contains the complete DevOps implementation including CI/CD pipelines, containerized backend, Infrastructure as Code, and a real-time monitoring dashboard.

**Live Dashboard:** https://d2wxexlx1nxsux.cloudfront.net  
**Backend API:** http://agni-guard-alb-1595568876.ap-south-1.elb.amazonaws.com

---

## Table of Contents

- [System Overview](#system-overview)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [DevOps Pipeline](#devops-pipeline)
- [Infrastructure](#infrastructure)
- [Backend API](#backend-api)
- [Frontend Dashboard](#frontend-dashboard)
- [Security](#security)
- [Testing](#testing)
- [Infrastructure as Code](#infrastructure-as-code)
- [Team](#team)

---

## System Overview

AGNI GUARD is a wireless sensor network (WSN) designed for wildfire detection in tropical forest environments. The system uses multi-sensor fusion combining BME688 gas resistance, BME280 environmental sensors, and PMS7003 particulate matter sensors to detect wildfire signatures with sub-10-minute detection time.

### Key Metrics
| Metric | Value |
|--------|-------|
| Detection Time | < 10 minutes |
| LoRa Range | > 2 km (field tested) |
| Packet Delivery Rate | 100% |
| Battery Life (edge node) | > 72 hours |
| System Uptime | 99.9% (AWS Fargate) |
| Test Coverage | 73.91% statements, 90% functions |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FIELD DEPLOYMENT                         │
│                                                             │
│  [Edge Node 1]  [Edge Node 2]  ...  [Edge Node N]           │
│  BME688/BME280                                              │
│  LoRa SX1278       LoRa P2P Communication                   │
│       │                 │                                   │
│       └────────┬────────┘                                   │
│                │                                            │
│         [Coordinator Node]                                  │
│         ESP32-S3 + LoRa                                     │
│         Google Sheets via WiFi                              │
└────────────────│────────────────────────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLOUD INFRASTRUCTURE                     │
│                                                             │
│  Google Sheets ──► Node.js Backend ──► AWS ECS Fargate      │
│  (Data Store)      (REST + WS API)     (Container)          │
│                          │                                  │
│                    AWS ALB (Port 80)                        │
│                          │                                  │
│              ┌───────────┴───────────┐                      │
│              │                       │                      │
│         REST API              WebSocket (8080)              │
│              │                       │                      │
│              └───────────┬───────────┘                      │
│                          │                                  │
│                  CloudFront CDN                             │
│                          │                                  │
│                   S3 Frontend                               │
│              (Static Dashboard)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
agni-dev/
├── backend/                    # Node.js REST API + WebSocket server
│   ├── server.js               # Main application entry point
│   ├── package.json            # Dependencies and scripts
│   ├── Dockerfile              # Multi-stage container build
│   └── tests/
│       └── api.test.js         # Jest + Supertest test suite
│
├── frontend/                   # Static dashboard
│   ├── index.html              # Main dashboard page
│   ├── css/
│   │   └── styles.css          # Dashboard styles
│   └── js/
│       └── app.js              # Dashboard logic + API integration
│
├── infrastructure/             # Terraform IaC
│   ├── main.tf                 # Root module
│   ├── variables.tf            # Input variables
│   ├── outputs.tf              # Output values
│   ├── versions.tf             # Provider versions + S3 backend
│   ├── terraform.tfvars        # Variable values (gitignored)
│   └── modules/
│       ├── ecr/                # AWS ECR repository
│       ├── ecs/                # AWS ECS Fargate cluster + service
│       ├── alb/                # Application Load Balancer
│       ├── iam/                # IAM roles and policies
│       ├── s3/                 # S3 bucket for frontend
│       ├── cloudfront/         # CloudFront distribution
│       └── secrets/            # Secrets Manager
│
└── .github/
    └── workflows/
        ├── ci.yml              # Continuous Integration pipeline
        ├── security.yml        # Security scanning pipeline
        └── deploy.yml          # Continuous Deployment pipeline
```

---

## DevOps Pipeline

### Three-Stage Pipeline

#### 1. CI Pipeline (`ci.yml`)
Triggered on every push and pull request.

```
Push/PR → Install Dependencies → Lint (ESLint)
        → Run Tests (Jest + Supertest)
        → Generate Coverage Report
        → Upload Coverage Artifact
```

**Test Results:**
- 35 test cases across 5 test suites
- 73.91% statement coverage
- 90% function coverage
- Coverage excludes infrastructure code per ISTQB standards

#### 2. Security Pipeline (`security.yml`)
Triggered on every push and pull request.

```
Push/PR → Secret Scanning (Gitleaks)
        → Static Analysis (CodeQL)
        → Container Scanning (Trivy)
        → Dependency Audit (npm audit)
        → SAST (ESLint security rules)
```

#### 3. Deploy Pipeline (`deploy.yml`)
Triggered on push to `main` branch only.

```
Push to main → Build Docker Image
             → Tag with Git SHA + :latest
             → Push to AWS ECR
             → Force Deploy to ECS Fargate
             → Sync Frontend to S3
             → Invalidate CloudFront Cache
```

### Multi-Environment Strategy

| Environment | Branch | Trigger | Infrastructure |
|-------------|--------|---------|----------------|
| Development | local | manual | Docker Compose |
| Staging | dev | auto on push | AWS ECS (staging) |
| Production | main | auto on push | AWS ECS (production) |

---

## Infrastructure

### AWS Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| ECS Fargate | Container orchestration | 1 vCPU, 2GB RAM |
| ECR | Container registry | Lifecycle: keep last 5 images |
| ALB | Load balancer | HTTP:80 → Container:3000 |
| S3 | Frontend hosting | Public static website |
| CloudFront | CDN | Global edge distribution |
| Secrets Manager | Credentials management | Injected at runtime |
| CloudWatch | Logging | 30-day retention |

### IAM Roles

| Role | Purpose |
|------|---------|
| AgniGuardECSExecutionRole | ECS task execution, ECR pull, Secrets access |
| AgniGuardECSTaskRole | CloudWatch logs write access |

### Networking

```
Internet → ALB (port 80) → ECS Security Group (port 3000)
                         → WebSocket (port 8080)
```

---

## Backend API

Base URL: `http://agni-guard-alb-1595568876.ap-south-1.elb.amazonaws.com`

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/api/sensor-data` | All sensor readings (filtered) |
| GET | `/api/sensor-data/latest` | Most recent valid reading |
| GET | `/api/aggregate` | System-wide aggregated data |
| GET | `/api/alerts` | Fire alert history |

### WebSocket

```
ws://agni-guard-alb-1595568876.ap-south-1.elb.amazonaws.com:8080
```

Broadcasts sensor data every 5 seconds to all connected clients.

### Data Source

Google Sheets via service account authentication using `google-spreadsheet` v4 and `google-auth-library`. Data is read from the `NodeData` sheet tab using dynamic header mapping to handle schema variations.

---

## Frontend Dashboard

**URL:** https://d2wxexlx1nxsux.cloudfront.net

Features:
- Real-time sensor data via WebSocket
- Multi-node monitoring (6 nodes)
- Fire stage indicators (NORMAL / ALERT / ELEVATED / CRITICAL)
- Temperature, humidity, pressure, gas resistance display
- Battery SOC and RSSI monitoring
- Rate-of-change parameters
- Auto-refresh every 5 seconds
- Fallback to simulation mode if backend unavailable

---

## Security

### Scanning Tools

| Tool | Purpose | Scope |
|------|---------|-------|
| Gitleaks | Secret detection | Git history + staged files |
| CodeQL | Static analysis | JavaScript source code |
| Trivy | Container scanning | Docker image vulnerabilities |
| npm audit | Dependency audit | Known CVEs in packages |
| ESLint | Code quality | Style + security rules |

### Secrets Management

All credentials stored in AWS Secrets Manager (`agni-guard/production`):
- `SHEET_ID` — Google Sheets document ID
- `CLIENT_EMAIL` — Service account email
- `PRIVATE_KEY` — Service account private key
- `PORT` — Application port
- `NODE_ENV` — Runtime environment

Secrets are injected as environment variables at ECS task launch time. No secrets are stored in the repository or Docker image.

---

## Testing

### Run Tests Locally

```bash
cd backend
npm install
npm test
```

### Test Coverage

```bash
npm run test:coverage
```

### Test Stack
- **Framework:** Jest
- **HTTP Testing:** Supertest
- **Mocking:** Sinon
- **Coverage:** Istanbul (NYC)

### Coverage Strategy

Infrastructure code (WebSocket server, SIGTERM handler, server start) is excluded using Istanbul ignore directives per ISTQB standards for infrastructure code.

---

## Infrastructure as Code

### Prerequisites

```bash
terraform --version  # >= 1.5.0
aws configure        # AWS credentials configured
```

### Initialize

```bash
cd infrastructure
terraform init
```

### Plan

```bash
terraform plan
```

### Apply

```bash
terraform apply
```

### State Backend

Terraform state is stored remotely in S3:
```
Bucket: agni-guard-dashboard
Key:    terraform/state/terraform.tfstate
Region: ap-south-1
```

### Modules

| Module | Resources |
|--------|-----------|
| `ecr` | ECR repository + lifecycle policy |
| `ecs` | ECS cluster + service + task definition + security group + CloudWatch log group |
| `alb` | ALB + listener + target group + security group |
| `iam` | Execution role + task role + policies |
| `s3` | S3 bucket + website config + public access block + bucket policy |
| `cloudfront` | CloudFront distribution reference |
| `secrets` | Secrets Manager secret reference |

---

## Team

| Member | Role |
|--------|------|
| Isuru Darshana Indrajith | Project Lead, DevOps Implementation, Hardware & PCB Design |
| Himan Michael | Firmware Development |
| Piyas Mohammed| LoRa Communications, Web Development |
| Ashinika Thathsarani | LoRa Link Budget Calculations, Theoretical Calculations |

**Institution:** General Sir John Kotelawala Defence University (KDU), Sri Lanka  
**Degree:** B.Sc. (Hons) in Electronic & Telecommunication Engineering  
**Year:** 2026

---

## Awards

🏆 **Best Paper Award** — KDU IGNITE'26(Except the Extension of CI/CD Part)

---

*This project is part of a final year research submission targeting IEEE Access publication.*
