data "aws_secretsmanager_secret" "this" {
  name = var.secret_name
}