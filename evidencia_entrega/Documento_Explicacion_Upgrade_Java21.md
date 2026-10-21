# Reporte Técnico: Upgrade de Microservicios a Java 21 y Configuración DevOps

**Proyecto:** Gestor de Proyectos (Microservicios Spring Boot)  
**Fecha:** 21 de Octubre de 2026  
**Entorno:** Jenkins LTS (JDK 21) & SonarQube LTS Community  

---

## 1. Resumen Ejecutivo

Como parte de los requisitos de modernización y aseguramiento de calidad en el ciclo de vida de desarrollo de software (CI/CD), se llevó a cabo la actualización técnica de los dos microservicios que integran la solución:

1. **`Ejercicio5Cliente`**: Frontend / Interfaz de usuario (Spring Boot + Thymeleaf + Bootstrap).
2. **`Ejercicio5MyAPIGestor`**: API REST y persistencia de datos (Spring Boot + Spring Data JPA + PostgreSQL).

Ambos proyectos fueron promovidos a **Java 21 LTS** y alineados a **Spring Boot 3.3.5**, integrando herramientas de análisis estático (**SonarQube**) y cobertura de código (**JaCoCo**) con umbral mínimo de calidad del 80%.

---

## 2. Detalle de Cambios por Microservicio

### 2.1. Microservicio 1: `Ejercicio5Cliente`

| Parámetro / Componente | Versión Original | Versión Actualizada | Justificación Técnica |
| :--- | :--- | :--- | :--- |
| **Java Version (`<java.version>`)** | `17` | **`21`** | Adopción del estándar Long Term Support (LTS) Java 21, habilitando soporte para Virtual Threads, mejoras en rendimiento de recolección de basura (ZGC/G1) y nuevas características del lenguaje. |
| **Spring Boot Starter Parent** | `3.2.5` | **`3.3.5`** | Compatibilidad oficial y optimizada con JDK 21, corrección de vulnerabilidades de seguridad y soporte para Spring Framework 6.1+. |
| **Versión del Artefacto (`<version>`)** | `0.0.1-SNAPSHOT` | **`1.0.0`** | Paso de versión de desarrollo preliminar a versión base estable. |
| **Sonar Maven Plugin** | *No presente* | **`5.5.0.6356`** | Requerimiento específico para ejecución de escaneo estático de código hacia SonarQube desde el pipeline de Maven. |
| **JaCoCo Maven Plugin** | *No presente* | **`0.8.12`** | Instrumentación de bytecode para cálculo de cobertura de pruebas unitarias (`jacoco.xml`) con regla de fallo en verificación (`minimum: 0.80` / 80%). |
| **Maven Surefire Plugin** | Predeterminado | **`3.3.1`** | Configuración explícita de ejecución de tests unitarios compatible con JVM 21 (`<argLine>${argLine}</argLine>` para inyección del agente JaCoCo). |

---

### 2.2. Microservicio 2: `Ejercicio5MyAPIGestor`

| Parámetro / Componente | Versión Original | Versión Actualizada | Justificación Técnica |
| :--- | :--- | :--- | :--- |
| **Java Version (`<java.version>`)** | `11` | **`21`** | Salto generacional mayor (+10 versiones de Java). Permite migrar de la especificación obsoleta `javax.*` a `jakarta.*` requerida por JPA/Hibernate moderno. |
| **Spring Boot Starter Parent** | `2.7.17` | **`3.3.5`** | Spring Boot 2.x finalizó su ciclo de soporte comunitario. Spring Boot 3.3.5 garantiza compatibilidad con Jakarta EE 10, Hibernate 6.x y Java 21. |
| **Driver de Base de Datos** | `mariadb-java-client` | **`postgresql`** | Alineación con la base de datos PostgreSQL productiva configurada en `application.properties`. |
| **Versión del Artefacto (`<version>`)** | `0.0.1-SNAPSHOT` | **`1.0.0`** | Versión base de producción. |
| **Sonar Maven Plugin** | *No presente* | **`5.5.0.6356`** | Plugin oficial para análisis continuo de código y detección de vulnerabilidades / code smells. |
| **JaCoCo Maven Plugin** | *No presente* | **`0.8.12`** | Generación de métricas de cobertura de código con umbral mínimo obligatorio del 80%. |
| **Maven Surefire Plugin** | Predeterminado | **`3.3.1`** | Compatibilidad con JUnit 5 en entorno Java 21 y enlace con agente JaCoCo. |

---

## 3. Configuración del Servidor Jenkins y SonarQube en Docker

Para asegurar la ejecución correcta del pipeline bajo los nuevos requerimientos, la infraestructura de contenedores fue actualizada de la siguiente manera:

1. **Jenkins Controller:**
   - **Imagen:** `jenkins/jenkins:lts-jdk21` (Contenedor nativo corriendo sobre OpenJDK 21).
   - **Volumen:** Volumen gestionado por Docker (`jenkins_home`) para garantizar compatibilidad completa con el sistema de archivos Linux (POSIX), evitando errores de concurrencia y permisos `read-only` observados en particiones NTFS/FAT32 de unidades externas.
   - **Herramientas (Global Tool Configuration):**
     - **JDK:** Configuración de `JDK21` apuntando a la JVM nativa o auto-instalable.
     - **Maven:** Configuración de `Maven21` (Apache Maven 3.9.x) compatible con compilación en Java 21 (`mvn -version`).

2. **SonarQube Server:**
   - **Imagen:** `sonarqube:lts-community` ejecutándose en el puerto `9000`.
   - **Comunicación:** Enlazado con Jenkins y Maven mediante el scanner oficial `org.sonarsource.scanner.maven:sonar-maven-plugin:5.5.0.6356`.

---

## 4. Archivos Entregables

La estructura de entrega contiene:

```text
evidencia_entrega/
├── Documento_Explicacion_Upgrade_Java21.md
├── pom_original/
│   ├── Ejercicio5Cliente-pom.xml
│   └── Ejercicio5MyAPIGestor-pom.xml
└── pom_actualizado/
    ├── Ejercicio5Cliente-pom.xml
    └── Ejercicio5MyAPIGestor-pom.xml
```
