module "ecr" {
  source          = "./modules/ecr"
  repository_name = var.ecr_repository_name
  project_name    = var.project_name
  environment     = var.environment
}

module "iam" {
  source       = "./modules/iam"
  project_name = var.project_name
  environment  = var.environment
  secret_name  = var.secret_name
  aws_region   = var.aws_region
}

module "secrets" {
  source       = "./modules/secrets"
  project_name = var.project_name
  environment  = var.environment
  secret_name  = var.secret_name
}

module "alb" {
  source         = "./modules/alb"
  project_name   = var.project_name
  environment    = var.environment
  container_port = var.container_port
}

module "ecs" {
  source              = "./modules/ecs"
  project_name        = var.project_name
  environment         = var.environment
  cluster_name        = var.ecs_cluster_name
  service_name        = var.ecs_service_name
  ecr_repository_url  = module.ecr.repository_url
  task_cpu            = var.ecs_task_cpu
  task_memory         = var.ecs_task_memory
  container_port      = var.container_port
  websocket_port      = var.websocket_port
  execution_role_arn  = module.iam.execution_role_arn
  task_role_arn       = module.iam.task_role_arn
  secret_arn          = module.secrets.secret_arn
  target_group_arn    = module.alb.target_group_arn
  alb_sg_id           = module.alb.security_group_id
}

module "s3" {
  source       = "./modules/s3"
  project_name = var.project_name
  environment  = var.environment
  bucket_name  = var.s3_bucket_name
}

module "cloudfront" {
  source              = "./modules/cloudfront"
  project_name        = var.project_name
  environment         = var.environment
  s3_bucket_domain    = module.s3.bucket_regional_domain
  distribution_id     = var.cloudfront_distribution_id
}