# Render Provider configuration.
# Credentials can be provided either via tfvars (ignored by Git) or via standard
# environment variables RENDER_API_KEY and RENDER_OWNER_ID (recommended for CI/CD).
provider "render" {
  api_key                    = var.render_api_key
  owner_id                   = var.render_owner_id
  wait_for_deploy_completion = var.wait_for_deploy_completion
}
