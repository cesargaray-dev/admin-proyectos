output "render_project_id" {
  description = "ID of the Render Project (null if create_render_project is false)."
  value       = var.create_render_project ? render_project.admin_proyectos[0].id : null
}

output "api_service_id" {
  description = "Render service ID for Ejercicio5MyAPIGestor."
  value       = render_web_service.api_gestor.id
}

output "api_service_slug" {
  description = "Render service slug for Ejercicio5MyAPIGestor."
  value       = render_web_service.api_gestor.slug
}

output "api_url" {
  description = "Public HTTPS base URL for Ejercicio5MyAPIGestor."
  value       = render_web_service.api_gestor.url
}

output "api_health_url" {
  description = "Spring Boot Actuator health endpoint for Ejercicio5MyAPIGestor."
  value       = "${render_web_service.api_gestor.url}/actuator/health"
}

output "api_metrics_url" {
  description = "Prometheus scrape endpoint for Ejercicio5MyAPIGestor."
  value       = "${render_web_service.api_gestor.url}/actuator/prometheus"
}

output "client_service_id" {
  description = "Render service ID for Ejercicio5Cliente."
  value       = render_web_service.cliente.id
}

output "client_service_slug" {
  description = "Render service slug for Ejercicio5Cliente."
  value       = render_web_service.cliente.slug
}

output "client_url" {
  description = "Public HTTPS base URL for Ejercicio5Cliente."
  value       = render_web_service.cliente.url
}

output "client_health_url" {
  description = "Spring Boot Actuator health endpoint for Ejercicio5Cliente."
  value       = "${render_web_service.cliente.url}/actuator/health"
}

output "client_metrics_url" {
  description = "Prometheus scrape endpoint for Ejercicio5Cliente."
  value       = "${render_web_service.cliente.url}/actuator/prometheus"
}

output "deploy_hooks_integration_note" {
  description = "Guidance for wiring Render Deploy Hooks into Jenkins CD."
  value       = "The official render-oss/render v1.9.x provider does not expose Deploy Hook URLs as resource attributes. Copy each Deploy Hook from Render Dashboard -> Service -> Settings -> Deploy Hook and store them in Jenkins as Secret Text credentials 'render-deploy-hook-api' and 'render-deploy-hook-cliente'."
}
