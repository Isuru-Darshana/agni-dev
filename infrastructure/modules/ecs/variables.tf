variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "service_name" {
  type = string
}

variable "ecr_repository_url" {
  type = string
}

variable "task_cpu" {
  type = number
}

variable "task_memory" {
  type = number
}

variable "container_port" {
  type = number
}

variable "websocket_port" {
  type = number
}

variable "execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "secret_arn" {
  type = string
}

variable "target_group_arn" {
  type = string
}

variable "alb_sg_id" {
  type = string
}