variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project name prefix"
  type        = string
  default     = "agni-guard"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "ecr_repository_name" {
  description = "ECR repository name"
  type        = string
  default     = "agni-guard-backend"
}

variable "ecs_cluster_name" {
  description = "ECS cluster name"
  type        = string
  default     = "agni-guard-cluster"
}

variable "ecs_service_name" {
  description = "ECS service name"
  type        = string
  default     = "agni-guard-backend-production"
}

variable "ecs_task_cpu" {
  description = "ECS task CPU units"
  type        = number
  default     = 1024
}

variable "ecs_task_memory" {
  description = "ECS task memory in MB"
  type        = number
  default     = 2048
}

variable "s3_bucket_name" {
  description = "S3 bucket name for frontend"
  type        = string
  default     = "agni-guard-dashboard"
}

variable "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  type        = string
  default     = "E2R7BW2FYKI94O"
}

variable "secret_name" {
  description = "Secrets Manager secret name"
  type        = string
  default     = "agni-guard/production"
}

variable "container_port" {
  description = "Container port for REST API"
  type        = number
  default     = 3000
}

variable "websocket_port" {
  description = "Container port for WebSocket"
  type        = number
  default     = 8080
}