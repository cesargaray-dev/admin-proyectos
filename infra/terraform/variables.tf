# ------------------------------------------------------------------------------
# Render Provider Authentication & Behavior
# ------------------------------------------------------------------------------
variable "render_api_key" {
  description = "Render API key generated from Render Account Settings. Leave null to read automatically from RENDER_API_KEY env var."
  type        = string
  default     = null
  sensitive   = true
}

variable "render_owner_id" {
  description = "Render owner ID (usr-... for individual accounts or tea-... for teams). Leave null to read from RENDER_OWNER_ID env var."
  type        = string
  default     = null
}

variable "wait_for_deploy_completion" {
  description = "Whether Terraform should wait for Render service deployments to finish before completing apply."
  type        = bool
  default     = false
}

# ------------------------------------------------------------------------------
# Project & Naming Configuration
# ------------------------------------------------------------------------------
variable "create_render_project" {
  description = "Create a Render Project and Environment to group both microservices logically."
  type        = bool
  default     = true
}

variable "project_name" {
  description = "Logical Render Project name grouping both microservices."
  type        = string
  default     = "admin-proyectos"
}

variable "environment_name" {
  description = "Environment name inside the Render Project (e.g., production, staging)."
  type        = string
  default     = "production"
}

variable "service_name_prefix" {
  description = "Prefix used for Render Web Service names to guarantee uniqueness."
  type        = string
  default     = "admin-proyectos"
}

# ------------------------------------------------------------------------------
# Source Repository & Deployment Settings
# ------------------------------------------------------------------------------
variable "github_repo_url" {
  description = "GitHub repository URL containing both Spring Boot microservices and their Dockerfiles."
  type        = string
  default     = "https://github.com/cesargaray-dev/admin-proyectos"
}

variable "github_branch" {
  description = "Git branch tracked by Render for building and deploying services."
  type        = string
  default     = "main"
}

variable "render_region" {
  description = "Render deployment region. Default 'ohio' matches Neon PostgreSQL us-east-2 for minimal latency."
  type        = string
  default     = "ohio"

  validation {
    condition     = contains(["frankfurt", "ohio", "oregon", "singapore", "virginia"], var.render_region)
    error_message = "render_region must be one of: frankfurt, ohio, oregon, singapore, virginia."
  }
}

variable "render_plan" {
  description = "Render compute tier for both Web Services ('free' for academic zero-cost deployment; 'starter' or higher for always-on workloads)."
  type        = string
  default     = "free"

  validation {
    condition     = contains(["free", "starter", "standard", "pro", "pro_plus", "pro_max", "pro_ultra"], var.render_plan)
    error_message = "render_plan must be one of: free, starter, standard, pro, pro_plus, pro_max, pro_ultra."
  }
}

variable "auto_deploy" {
  description = "Enable automatic Render redeploys when commits matching each service build_filter are pushed."
  type        = bool
  default     = true
}

# ------------------------------------------------------------------------------
# Neon PostgreSQL & Spring Boot Runtime Variables (Injected Securely)
# ------------------------------------------------------------------------------
variable "db_url" {
  description = "JDBC connection string for Neon PostgreSQL (must include ?sslmode=require)."
  type        = string
  sensitive   = true

  validation {
    condition     = startswith(var.db_url, "jdbc:postgresql://")
    error_message = "db_url must be a valid PostgreSQL JDBC URL starting with 'jdbc:postgresql://'."
  }
}

variable "db_username" {
  description = "Neon PostgreSQL database username."
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Neon PostgreSQL database password (never commit real values to Git)."
  type        = string
  sensitive   = true
}

variable "db_pool_max" {
  description = "Maximum HikariCP connection pool size (kept low for Neon serverless and Render 512MB RAM tier)."
  type        = number
  default     = 5

  validation {
    condition     = var.db_pool_max >= 1 && var.db_pool_max <= 20
    error_message = "db_pool_max must be between 1 and 20."
  }
}

variable "jpa_ddl_auto" {
  description = "Hibernate spring.jpa.hibernate.ddl-auto strategy."
  type        = string
  default     = "update"

  validation {
    condition     = contains(["none", "validate", "update", "create", "create-drop"], var.jpa_ddl_auto)
    error_message = "jpa_ddl_auto must be one of: none, validate, update, create, create-drop."
  }
}

variable "jpa_show_sql" {
  description = "Whether Hibernate logs SQL statements (recommended false in cloud environments)."
  type        = bool
  default     = false
}
