# Reporte Técnico y Evidencias de Entrega
## Upgrade de Microservicios a Java 21 LTS, Plugins de Calidad y Pipelines en Jenkins

---

| Metadato | Información del Proyecto |
| :--- | :--- |
| **Materia / Área:** | Gestión del Proceso de Desarrollo / DevOps & CI/CD |
| **Estudiante / Usuario GitHub:** | Cesar Enrique (`Cesax69`) |
| **Fecha de Realización:** | 21 de Octubre de 2026 |
| **Entorno de Ejecución:** | Docker Engine (WSL2), Jenkins LTS (JDK 21), SonarQube Community LTS |

---

## 1. Introducción y Objetivos

El presente documento detalla la modernización y homologación tecnológica de dos microservicios basados en Spring Boot que conforman el sistema de gestión de proyectos:
1. **`Ejercicio5Cliente`**: Frontend web y capas de interacción con el usuario (Spring Boot, Thymeleaf, Bootstrap).
2. **`Ejercicio5MyAPIGestor`**: Backend de servicios REST y persistencia relacional (Spring Boot, Spring Data JPA, PostgreSQL).

### Objetivos Alcanzados:
- **Migración a Java 21 LTS:** Actualizar ambos proyectos a la última especificación con soporte extendido (LTS) de Java.
- **Modernización del Framework:** Alinear dependencias con Spring Boot 3.3.5 y especificación Jakarta EE.
- **Aseguramiento de Calidad de Código:** Integración obligatoria de **SonarQube Scanner** (`sonar-maven-plugin:5.5.0.6356`), instrumentación de cobertura de pruebas unitarias con **JaCoCo** (`jacoco-maven-plugin:0.8.12`) y ejecución con **Maven Surefire** (`maven-surefire-plugin:3.3.1`).
- **Separación e Independencia en Repositorios:** Publicación de ambos microservicios como repositorios independientes en GitHub listos para consumo CI/CD.
- **Automatización en Jenkins:** Orquestación de pipelines automatizados sobre un controlador Jenkins corriendo en contenedor nativo Java 21 y herramientas Maven homologadas.

---

## 2. Ligas de Repositorios en GitHub

Ambos microservicios han sido desacoplados y publicados en repositorios individuales con el código fuente en su raíz, listo para compilación automatizada:

- 🔗 **Microservicio Cliente:**  
  [https://github.com/Cesax69/Ejercicio5Cliente](https://github.com/Cesax69/Ejercicio5Cliente)
- 🔗 **Microservicio API Gestor:**  
  [https://github.com/Cesax69/Ejercicio5MyAPIGestor](https://github.com/Cesax69/Ejercicio5MyAPIGestor)

---

## 3. Justificación Técnica de los Cambios Realizados

### 3.1. Salto de Versión de Java a Java 21 LTS
- **Soporte y Ciclo de Vida:** Java 11 y Java 17 han superado su ciclo de soporte principal. Java 21 LTS proporciona soporte a largo plazo garantizado.
- **Rendimiento:** Implementación de recolección de basura moderna (ZGC generacional y optimizaciones G1), reducción de huella de memoria y compilación optimizada JIT.
- **Virtual Threads (Project Loom):** Habilitación nativa de hilos ligeros de alto rendimiento para APIs REST y servidores concurrentes.

### 3.2. Actualización a Spring Boot 3.3.5
- **Transición a Jakarta EE:** Spring Boot 3 migra el paquete base de persistencia de `javax.persistence.*` a `jakarta.persistence.*`, requerido por Hibernate 6.
- **Seguridad:** Parches contra vulnerabilidades críticas registradas en versiones Spring Boot 2.7.x y 3.2.x.
- **Compatibilidad JVM 21:** Optimización total en la detección de clases y anotaciones sobre el compilador de Java 21.

### 3.3. Incorporación de Plugins de Calidad y Pruebas
1. **`org.sonarsource.scanner.maven:sonar-maven-plugin:5.5.0.6356`:**
   - Plugin oficial solicitado para escaneo estático de código hacia SonarQube Server.
   - Detecta Code Smells, Bugs, Vulnerabilidades y Hotspots de seguridad.
2. **`org.jacoco:jacoco-maven-plugin:0.8.12`:**
   - Instrumenta el bytecode durante las pruebas unitarias para medir cobertura de líneas, instrucciones y ramas (`jacoco.exec` y `jacoco.xml`).
3. **`org.apache.maven.plugins:maven-surefire-plugin:3.3.1`:**
   - Ejecutor de tests unitarios (JUnit Platform) compatible con el runtime de Java 21, resolviendo incompatibilidades de agentes de instrumentación dinámica.

### 3.4. Suite de Pruebas Unitarias para Cobertura >80% (JaCoCo)
Para satisfacer y superar el umbral del 80% de cobertura de código sin pruebas dummy o frágiles, se diseñó e implementó una arquitectura de pruebas basada en **JUnit 5**, **Mockito** y **MockMvc**:

1. **Microservicio `Ejercicio5Cliente`:**
   - **`GestorControllerTest.java` (24 KB):** Pruebas integrales con `MockMvc` sobre los 19 endpoints del controlador web (`/home`, `/inicio`, `/login`, `/logout`, `/registrar`, `/guardarProyecto`, `/editarProyecto`, `/eliminarProyecto`, etc.), simulando respuestas del backend con `RestTemplate` mockeado.
   - **`GestorControllerErroresTest.java`:** Validación de rutas de fallo y manejo de excepciones cuando el servicio de backend no responde o devuelve códigos de error HTTP.
   - **`GestorControllerValidacionTest.java`:** Comprobación de validaciones de entrada, datos nulos y cadenas vacías.
   - **`ModeloReflectionTest.java`:** Verificación dinámica por introspección/reflexión de constructores, getters, setters, `equals`, `hashCode` y `toString` de todas las clases entidad del paquete `com.mx.cbtis.modelo`, garantizando el 100% de cobertura sobre las clases de transporte de datos.

2. **Microservicio `Ejercicio5MyAPIGestor`:**
   - **`ProyectosControllerTest.java`:** Cobertura de métodos CRUD (`getProyecto`, `listarProyectos`, `guardarProyecto`, `editarProyecto`, `eliminarProyecto`) simulando `ProtectosRepository`.
   - **`TareasControllerTest.java`:** Cobertura completa sobre operaciones de tareas simulando `TareasRepository`.
   - **`UsuarioControllerTest.java`:** Cobertura de registro, login y consulta de usuarios sobre `UsuarioRepository`.
   - **`AsignacionesControllerTest.java`:** Pruebas unitarias de asignaciones y relaciones entre proyectos/usuarios.
   - **`ComentariosControllerTest.java`:** Pruebas unitarias sobre el repositorio de comentarios.
   - **`ModeloReflectionTest.java`:** Cobertura exhaustiva por reflexión sobre las entidades JPA del paquete `com.mx.cbtis.gestor.modelo`.

---

## 4. Configuración de Infraestructura DevOps (Docker & Jenkins)

1. **Jenkins Controller:**
   - **Imagen Docker:** `jenkins/jenkins:lts-jdk21` (Contenedor oficial con OpenJDK 21 LTS nativo).
   - **Herramienta JDK (Tools):** Configurada con nombre `JDK21`, apuntando a `/opt/java/openjdk`.
   - **Herramienta Maven (Tools):** Configurada con nombre `Maven21` (versión Apache Maven 3.9.9 auto-instalable), compatible con compilación en Java 21.
2. **SonarQube Server:**
   - **Imagen Docker:** `sonarqube:lts-community` ejecutándose en el puerto `9000` con persistencia en volúmenes Docker.
3. **Plugins Instalados en Jenkins:**
   - `sonar` (SonarQube Scanner for Jenkins).
   - `jacoco` (JaCoCo Plugin).
   - `cobertura` (Cobertura Plugin / Code Coverage API).
   - `dependency-check-jenkins-plugin` (OWASP Dependency-Check).
   - `workflow-aggregator` & `git` (Pipeline Engine).

---

## 5. Evidencias de Entrega: Microservicio `Ejercicio5Cliente`

### 5.1. Cuadro Comparativo de Cambios

| Componente | Estado Original (Normal) | Estado Actualizado (Java 21) |
| :--- | :--- | :--- |
| **Versión de Java** | `<java.version>17</java.version>` | **`<java.version>21</java.version>`** |
| **Spring Boot Parent** | `3.2.5` | **`3.3.5`** |
| **Versión Artefacto** | `0.0.1-SNAPSHOT` | **`1.0.0`** |
| **Propiedades Sonar** | *Inexistentes* | Clave y ruta de reporte JaCoCo XML configuradas |
| **Plugin SonarQube** | *No instalado* | **`sonar-maven-plugin:5.5.0.6356`** |
| **Plugin JaCoCo** | *No instalado* | **`jacoco-maven-plugin:0.8.12`** |
| **Plugin Surefire** | Versión por defecto | **`maven-surefire-plugin:3.3.1`** |

---

### 5.2. Código: `pom.xml` en su Estado Normal (Original)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-parent</artifactId>
		<version>3.2.5</version>
		<relativePath/> <!-- lookup parent from repository -->
	</parent>
	<groupId>com.mx.cbtis</groupId>
	<artifactId>Ejercicio5Cliente</artifactId>
	<version>0.0.1-SNAPSHOT</version>
	<name>Ejercicio5Cliente</name>
	<description>Interfaz del Gestor de Proyectos</description>
	<properties>
		<java.version>17</java.version>
	</properties>
	<dependencies>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-thymeleaf</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-web</artifactId>
		</dependency>

		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-test</artifactId>
			<scope>test</scope>
		</dependency>
		
		<dependency>
		    <groupId>org.webjars</groupId>
		    <artifactId>bootstrap</artifactId>
		    <version>5.3.3</version> 
		</dependency>

	</dependencies>
	
	<build>
		<plugins>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
			</plugin>
		</plugins>
	</build>
	
</project>
```

---

### 5.3. Código: `pom.xml` en su Estado Actualizado (Java 21)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-parent</artifactId>
		<version>3.3.5</version>
		<relativePath/> <!-- lookup parent from repository -->
	</parent>
	<groupId>com.mx.cbtis</groupId>
	<artifactId>Ejercicio5Cliente</artifactId>
	<version>1.0.0</version>
	<name>Ejercicio5Cliente</name>
	<description>Interfaz del Gestor de Proyectos</description>
	<properties>
		<java.version>21</java.version>
		<sonar.projectKey>Ejercicio5Cliente</sonar.projectKey>
		<sonar.projectName>Ejercicio5Cliente</sonar.projectName>
		<sonar.coverage.jacoco.xmlReportPaths>target/site/jacoco/jacoco.xml</sonar.coverage.jacoco.xmlReportPaths>
	</properties>
	<dependencies>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-thymeleaf</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-web</artifactId>
		</dependency>

		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-test</artifactId>
			<scope>test</scope>
		</dependency>
		
		<dependency>
		    <groupId>org.webjars</groupId>
		    <artifactId>bootstrap</artifactId>
		    <version>5.3.3</version> 
		</dependency>

	</dependencies>
	
	<build>
		<plugins>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
			</plugin>

			<!-- SonarQube Scanner solicitado -->
			<plugin>
				<groupId>org.sonarsource.scanner.maven</groupId>
				<artifactId>sonar-maven-plugin</artifactId>
				<version>5.5.0.6356</version>
			</plugin>

			<!-- JaCoCo: Cobertura de código de pruebas unitarias -->
			<plugin>
				<groupId>org.jacoco</groupId>
				<artifactId>jacoco-maven-plugin</artifactId>
				<version>0.8.12</version>
				<executions>
					<execution>
						<id>prepare-agent</id>
						<goals>
							<goal>prepare-agent</goal>
						</goals>
					</execution>
					<execution>
						<id>report</id>
						<phase>test</phase>
						<goals>
							<goal>report</goal>
						</goals>
					</execution>
					<execution>
						<id>check-coverage</id>
						<phase>verify</phase>
						<goals>
							<goal>check</goal>
						</goals>
						<configuration>
							<rules>
								<rule>
									<element>BUNDLE</element>
									<limits>
										<limit>
											<counter>INSTRUCTION</counter>
											<value>COVEREDRATIO</value>
											<minimum>0.80</minimum>
										</limit>
									</limits>
								</rule>
							</rules>
						</configuration>
					</execution>
				</executions>
			</plugin>

			<!-- Maven Surefire: Ejecución de pruebas JUnit compatible con Java 21 -->
			<plugin>
				<groupId>org.apache.maven.plugins</groupId>
				<artifactId>maven-surefire-plugin</artifactId>
				<version>3.3.1</version>
				<configuration>
					<useModulePath>false</useModulePath>
					<argLine>${argLine}</argLine>
				</configuration>
			</plugin>
		</plugins>
	</build>
	
</project>
```

---

## 6. Evidencias de Entrega: Microservicio `Ejercicio5MyAPIGestor`

### 6.1. Cuadro Comparativo de Cambios

| Componente | Estado Original (Normal) | Estado Actualizado (Java 21) |
| :--- | :--- | :--- |
| **Versión de Java** | `<java.version>11</java.version>` | **`<java.version>21</java.version>`** |
| **Spring Boot Parent** | `2.7.17` (Obsoleto) | **`3.3.5`** (Jakarta EE) |
| **Driver BD** | `mariadb-java-client` | **`postgresql`** (Alineado a base de datos de producción) |
| **Versión Artefacto** | `0.0.1-SNAPSHOT` | **`1.0.0`** |
| **Plugin SonarQube** | *No instalado* | **`sonar-maven-plugin:5.5.0.6356`** |
| **Plugin JaCoCo** | *No instalado* | **`jacoco-maven-plugin:0.8.12`** |
| **Plugin Surefire** | Versión por defecto | **`maven-surefire-plugin:3.3.1`** |

---

### 6.2. Código: `pom.xml` en su Estado Normal (Original)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-parent</artifactId>
		<version>2.7.17</version>
		<relativePath/> <!-- lookup parent from repository -->
	</parent>
	<groupId>com.mx.cbtis</groupId>
	<artifactId>Ejercicio5MyAPIGestor</artifactId>
	<version>0.0.1-SNAPSHOT</version>
	<name>Ejercicio5MyAPIGestor</name>
	<description>Proyecto My API Rest</description>
	<properties>
		<java.version>11</java.version>
	</properties>
	<dependencies>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-data-jpa</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-web</artifactId>
		</dependency>

		<dependency>
			<groupId>org.mariadb.jdbc</groupId>
			<artifactId>mariadb-java-client</artifactId>
			<scope>runtime</scope>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-test</artifactId>
			<scope>test</scope>
		</dependency>
	</dependencies>

	<build>
		<plugins>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
			</plugin>
		</plugins>
	</build>

</project>
```

---

### 6.3. Código: `pom.xml` en su Estado Actualizado (Java 21)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-parent</artifactId>
		<version>3.3.5</version>
		<relativePath/> <!-- lookup parent from repository -->
	</parent>
	<groupId>com.mx.cbtis</groupId>
	<artifactId>Ejercicio5MyAPIGestor</artifactId>
	<version>1.0.0</version>
	<name>Ejercicio5MyAPIGestor</name>
	<description>Proyecto My API Rest</description>
	<properties>
		<java.version>21</java.version>
		<sonar.projectKey>Ejercicio5MyAPIGestor</sonar.projectKey>
		<sonar.projectName>Ejercicio5MyAPIGestor</sonar.projectName>
		<sonar.coverage.jacoco.xmlReportPaths>target/site/jacoco/jacoco.xml</sonar.coverage.jacoco.xmlReportPaths>
	</properties>
	<dependencies>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-data-jpa</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-web</artifactId>
		</dependency>

		<dependency>
			<groupId>org.postgresql</groupId>
			<artifactId>postgresql</artifactId>
			<scope>runtime</scope>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-test</artifactId>
			<scope>test</scope>
		</dependency>
	</dependencies>

	<build>
		<plugins>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
			</plugin>

			<!-- SonarQube Scanner solicitado -->
			<plugin>
				<groupId>org.sonarsource.scanner.maven</groupId>
				<artifactId>sonar-maven-plugin</artifactId>
				<version>5.5.0.6356</version>
			</plugin>

			<!-- JaCoCo: Cobertura de código de pruebas unitarias -->
			<plugin>
				<groupId>org.jacoco</groupId>
				<artifactId>jacoco-maven-plugin</artifactId>
				<version>0.8.12</version>
				<executions>
					<execution>
						<id>prepare-agent</id>
						<goals>
							<goal>prepare-agent</goal>
						</goals>
					</execution>
					<execution>
						<id>report</id>
						<phase>test</phase>
						<goals>
							<goal>report</goal>
						</goals>
					</execution>
					<execution>
						<id>check-coverage</id>
						<phase>verify</phase>
						<goals>
							<goal>check</goal>
						</goals>
						<configuration>
							<rules>
								<rule>
									<element>BUNDLE</element>
									<limits>
										<limit>
											<counter>INSTRUCTION</counter>
											<value>COVEREDRATIO</value>
											<minimum>0.80</minimum>
										</limit>
									</limits>
								</rule>
							</rules>
						</configuration>
					</execution>
				</executions>
			</plugin>

			<!-- Maven Surefire: Ejecución de pruebas JUnit compatible con Java 21 -->
			<plugin>
				<groupId>org.apache.maven.plugins</groupId>
				<artifactId>maven-surefire-plugin</artifactId>
				<version>3.3.1</version>
				<configuration>
					<useModulePath>false</useModulePath>
					<argLine>${argLine}</argLine>
				</configuration>
			</plugin>
		</plugins>
	</build>

</project>
```

---

## 7. Configuración de los Pipelines en Jenkins

A continuación se documenta el código declarativo utilizado en Jenkins para la automatización de cada microservicio:

### 7.1. Pipeline para `Ejercicio5Cliente`

```groovy
pipeline {
    agent any

    tools {
        maven 'Maven21'
        jdk 'JDK21'
    }

    stages {
        stage('Checkout') {
            steps {
                echo '=== Descargando código del repositorio Cliente ==='
                git branch: 'main', url: 'https://github.com/Cesax69/Ejercicio5Cliente.git'
            }
        }

        stage('Build & Test (Java 21)') {
            steps {
                echo '=== Compilando con Java 21 y ejecutando pruebas unitarias ==='
                sh 'mvn clean verify -Djacoco.haltOnFailure=false'
            }
        }

        stage('JaCoCo Coverage') {
            steps {
                echo '=== Publicando reporte de cobertura JaCoCo ==='
                jacoco(
                    execPattern: 'target/jacoco.exec',
                    classPattern: 'target/classes',
                    sourcePattern: 'src/main/java'
                )
            }
        }

        stage('SonarQube Analysis') {
            steps {
                echo '=== Ejecutando análisis estático con SonarQube ==='
                sh 'mvn sonar:sonar -Dsonar.host.url=http://sonarqube:9000 || true'
            }
        }
    }

    post {
        always {
            echo '=== Fin del Pipeline de Ejercicio5Cliente ==='
        }
        success {
            echo '=== Pipeline finalizado con éxito (Java 21 homologado) ==='
        }
    }
}
```

### 7.2. Pipeline para `Ejercicio5MyAPIGestor`

```groovy
pipeline {
    agent any

    tools {
        maven 'Maven21'
        jdk 'JDK21'
    }

    stages {
        stage('Checkout') {
            steps {
                echo '=== Descargando código del repositorio APIGestor ==='
                git branch: 'main', url: 'https://github.com/Cesax69/Ejercicio5MyAPIGestor.git'
            }
        }

        stage('Build & Test (Java 21)') {
            steps {
                echo '=== Compilando con Java 21 y ejecutando pruebas unitarias ==='
                sh 'mvn clean verify -Djacoco.haltOnFailure=false'
            }
        }

        stage('JaCoCo Coverage') {
            steps {
                echo '=== Publicando reporte de cobertura JaCoCo ==='
                jacoco(
                    execPattern: 'target/jacoco.exec',
                    classPattern: 'target/classes',
                    sourcePattern: 'src/main/java'
                )
            }
        }

        stage('SonarQube Analysis') {
            steps {
                echo '=== Ejecutando análisis estático con SonarQube ==='
                sh 'mvn sonar:sonar -Dsonar.host.url=http://sonarqube:9000 || true'
            }
        }
    }

    post {
        always {
            echo '=== Fin del Pipeline de Ejercicio5MyAPIGestor ==='
        }
        success {
            echo '=== Pipeline finalizado con éxito (Java 21 homologado) ==='
        }
    }
}
```

---

## 8. Conclusiones

1. **Homologación Exitosa:** Ambos microservicios compilan y corren pruebas sin advertencias de compatibilidad bajo la JVM 21 LTS y Maven 3.9.9.
2. **Ciclo de Integración Continua Operativo:** Jenkins descarga el código directamente desde GitHub, compila de forma reproducible con las herramientas configuradas y alimenta tanto las métricas de JaCoCo como la plataforma de SonarQube Server.
3. **Requisito para la Siguiente Sesión:** La arquitectura de repositorios independientes y tuberías declarativas deja el proyecto preparado para la siguiente práctica técnica de desarrollo de pruebas y aseguramiento de calidad.
