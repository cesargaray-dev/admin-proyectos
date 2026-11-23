locals {
  api_service_name    = "${var.service_name_prefix}-api-gestor"
  client_service_name = "${var.service_name_prefix}-cliente"
  environment_id      = var.create_render_project ? render_project.admin_proyectos[0].environments[var.environment_name].id : null
}

# ------------------------------------------------------------------------------
# Logical Project & Environment Grouping on Render
# ------------------------------------------------------------------------------
resource "render_project" "admin_proyectos" {
  count = var.create_render_project ? 1 : 0
  name  = var.project_name

  environments = {
    (var.environment_name) = {
      name             = var.environment_name
      network_isolated = false
      protected_status = "unprotected"
    }
  }
}

# ------------------------------------------------------------------------------
# Backend Microservice: Ejercicio5MyAPIGestor (Spring Boot 3 / Java 21 + Neon)
# ------------------------------------------------------------------------------
resource "render_web_service" "api_gestor" {
  name              = local.api_service_name
  plan              = var.render_plan
  region            = var.render_region
  environment_id    = local.environment_id
  health_check_path = "/actuator/health"

  runtime_source = {
    docker = {
      repo_url        = var.github_repo_url
      branch          = var.github_branch
      dockerfile_path = "./Ejercicio5MyAPIGestor/Dockerfile"
      context         = "./Ejercicio5MyAPIGestor"
      auto_deploy     = var.auto_deploy
      build_filter = {
        paths = ["Ejercicio5MyAPIGestor/**"]
      }
    }
  }

  env_vars = {
    "DB_URL" = {
      value = var.db_url
    }
    "DB_USERNAME" = {
      value = var.db_username
    }
    "DB_PASSWORD" = {
      value = var.db_password
    }
    "DB_POOL_MAX" = {
      value = tostring(var.db_pool_max)
    }
    "JPA_DDL_AUTO" = {
      value = var.jpa_ddl_auto
    }
    "JPA_SHOW_SQL" = {
      value = tostring(var.jpa_show_sql)
    }
  }
}

# ------------------------------------------------------------------------------
# Frontend Microservice: Ejercicio5Cliente (Spring Boot 3 / Thymeleaf / Java 21)
# Dynamically wired to the provisioned API Gestor HTTPS URL.
# ------------------------------------------------------------------------------
resource "render_web_service" "cliente" {
  name              = local.client_service_name
  plan              = var.render_plan
  region            = var.render_region
  environment_id    = local.environment_id
  health_check_path = "/actuator/health"

  runtime_source = {
    docker = {
      repo_url        = var.github_repo_url
      branch          = var.github_branch
      dockerfile_path = "./Ejercicio5Cliente/Dockerfile"
      context         = "./Ejercicio5Cliente"
      auto_deploy     = var.auto_deploy
      build_filter = {
        paths = ["Ejercicio5Cliente/**"]
      }
    }
  }

  env_vars = {
    "API_BASE_URL" = {
      value = render_web_service.api_gestor.url
    }
  }
}
