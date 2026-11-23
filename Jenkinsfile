// =============================================================================
// Jenkinsfile – Circuito DevOps Completo con IaC (Unidad III – Admin Proyectos)
//
// Flujo automatizado en Jenkins local (Docker):
//   1. Checkout SCM
//   2. Build, Pruebas Unitarias (Surefire) y Cobertura JaCoCo (>= 80%) – Cliente
//   3. Build, Pruebas Unitarias (Surefire) y Cobertura JaCoCo (>= 80%) – APIGestor
//   4. Análisis de Calidad Estática (SonarQube) – Cliente y APIGestor
//   5. Análisis Estático de Seguridad SAST (Semgrep)
//   6. Verificación de Empaquetado de Imágenes Docker (multi-stage non-root)
//   7. Validación de Infraestructura como Código (Terraform fmt & validate)
//   8. [Opcional] OWASP Dependency-Check
//   9. [Opcional CD] Despliegue Continuo a Render vía Deploy Hooks + Health Check
//      + Prueba Smoke automatizada con Grafana k6
//
// Seguridad: CERO contraseñas, tokens o URLs secretas en el código.
// Credenciales requeridas en Jenkins:
//   - sonarqube-token             (Secret text)
//   - render-deploy-hook-api      (Secret text, solo si DEPLOY_TO_RENDER=true)
//   - render-deploy-hook-cliente  (Secret text, solo si DEPLOY_TO_RENDER=true)
// =============================================================================

pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '15'))
    }

    parameters {
        booleanParam(
            name: 'RUN_OWASP_CHECK',
            defaultValue: false,
            description: 'Ejecutar análisis completo OWASP Dependency-Check (puede tardar varios minutos en primera descarga NVD).'
        )
        booleanParam(
            name: 'DEPLOY_TO_RENDER',
            defaultValue: false,
            description: 'Activar etapa de Despliegue Continuo (CD) hacia Render Cloud mediante Deploy Hooks.'
        )
        string(
            name: 'RENDER_API_URL',
            defaultValue: '',
            description: 'URL HTTPS pública de api-gestor en Render (ej. https://admin-proyectos-api-gestor.onrender.com) para health check y k6 smoke.'
        )
        string(
            name: 'RENDER_CLIENT_URL',
            defaultValue: '',
            description: 'URL HTTPS pública de cliente en Render (ej. https://admin-proyectos-cliente.onrender.com) para health check y k6 smoke.'
        )
        booleanParam(
            name: 'RUN_K6_SMOKE',
            defaultValue: true,
            description: 'Ejecutar verificación smoke automatizada con Grafana k6 después del despliegue CD.'
        )
    }

    tools {
        // Configurar en: Administrar Jenkins -> Tools -> Maven ('Maven21') y JDK ('JDK21')
        maven 'Maven21'
        jdk 'JDK21'
    }

    environment {
        SONAR_HOST_URL  = 'http://sonarqube:9000'
        SONAR_TOKEN     = credentials('sonarqube-token')
        TERRAFORM_IMAGE = 'hashicorp/terraform:1.9'
        K6_IMAGE        = 'grafana/k6:0.54.0'
    }

    stages {

        // ─────────────────────────────────────────────────────────────────────
        // STAGE 1 – Descarga de código
        // ─────────────────────────────────────────────────────────────────────
        stage('Checkout') {
            steps {
                echo '=== 1. Descarga de código de la rama activa ==='
                checkout scm
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STAGE 2 – Build, Pruebas Surefire y Cobertura JaCoCo >= 80% (Cliente)
        // ─────────────────────────────────────────────────────────────────────
        stage('Build & Test – Cliente') {
            steps {
                echo '=== 2a. Compilación, pruebas unitarias y JaCoCo – Ejercicio5Cliente ==='
                dir('Ejercicio5Cliente') {
                    sh 'mvn clean verify -Djava.version=21 -Dsurefire.useFile=false'
                }
                junit allowEmptyResults: true, testResults: 'Ejercicio5Cliente/target/surefire-reports/*.xml'
                jacoco(
                    execPattern: 'Ejercicio5Cliente/target/jacoco.exec',
                    classPattern: 'Ejercicio5Cliente/target/classes',
                    sourcePattern: 'Ejercicio5Cliente/src/main/java',
                    minimumInstructionCoverage: '80',
                    minimumBranchCoverage: '0',
                    minimumComplexityCoverage: '0',
                    minimumLineCoverage: '0',
                    minimumMethodCoverage: '0',
                    minimumClassCoverage: '0'
                )
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STAGE 3 – Build, Pruebas Surefire y Cobertura JaCoCo >= 80% (APIGestor)
        // ─────────────────────────────────────────────────────────────────────
        stage('Build & Test – APIGestor') {
            steps {
                echo '=== 2b. Compilación, pruebas unitarias y JaCoCo – Ejercicio5MyAPIGestor ==='
                dir('Ejercicio5MyAPIGestor') {
                    sh 'mvn clean verify -Djava.version=21 -Dsurefire.useFile=false'
                }
                junit allowEmptyResults: true, testResults: 'Ejercicio5MyAPIGestor/target/surefire-reports/*.xml'
                jacoco(
                    execPattern: 'Ejercicio5MyAPIGestor/target/jacoco.exec',
                    classPattern: 'Ejercicio5MyAPIGestor/target/classes',
                    sourcePattern: 'Ejercicio5MyAPIGestor/src/main/java',
                    minimumInstructionCoverage: '80',
                    minimumBranchCoverage: '0',
                    minimumComplexityCoverage: '0',
                    minimumLineCoverage: '0',
                    minimumMethodCoverage: '0',
                    minimumClassCoverage: '0'
                )
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STAGE 4 – Análisis SonarQube (Ambos microservicios)
        // ─────────────────────────────────────────────────────────────────────
        stage('SonarQube Analysis') {
            parallel {
                stage('SonarQube – Cliente') {
                    steps {
                        echo '=== 3a. Análisis SonarQube – Ejercicio5Cliente ==='
                        dir('Ejercicio5Cliente') {
                            sh '''
                                mvn sonar:sonar \
                                    -Dsonar.host.url="${SONAR_HOST_URL}" \
                                    -Dsonar.token="${SONAR_TOKEN}" \
                                    -Dsonar.projectKey=Ejercicio5Cliente \
                                    -Dsonar.projectName='Ejercicio5Cliente' \
                                    -Dsonar.coverage.jacoco.xmlReportPaths=target/site/jacoco/jacoco.xml
                            '''
                        }
                    }
                }
                stage('SonarQube – APIGestor') {
                    steps {
                        echo '=== 3b. Análisis SonarQube – Ejercicio5MyAPIGestor ==='
                        dir('Ejercicio5MyAPIGestor') {
                            sh '''
                                mvn sonar:sonar \
                                    -Dsonar.host.url="${SONAR_HOST_URL}" \
                                    -Dsonar.token="${SONAR_TOKEN}" \
                                    -Dsonar.projectKey=Ejercicio5MyAPIGestor \
                                    -Dsonar.projectName='Ejercicio5MyAPIGestor' \
                                    -Dsonar.coverage.jacoco.xmlReportPaths=target/site/jacoco/jacoco.xml
                            '''
                        }
                    }
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STAGE 5 – Análisis Estático de Seguridad SAST (Semgrep)
        // ─────────────────────────────────────────────────────────────────────
        stage('SAST Scan (Semgrep)') {
            steps {
                echo '=== 4. Escaneo Estático de Seguridad (SAST) con Semgrep ==='
                sh '''
                    mkdir -p reportes
                    docker run --rm \
                        --network bridge \
                        --volumes-from jenkins \
                        -w "${WORKSPACE}" \
                        semgrep/semgrep \
                        semgrep scan \
                            --config=auto \
                            --json \
                            --output=reportes/semgrep-report.json \
                            Ejercicio5MyAPIGestor Ejercicio5Cliente infra/terraform || true
                '''
                archiveArtifacts artifacts: 'reportes/semgrep-report.json', allowEmptyArchive: true, fingerprint: true
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STAGE 6 – Verificación de Construcción de Imágenes Docker
        // ─────────────────────────────────────────────────────────────────────
        stage('Docker Image Build Verification') {
            steps {
                echo '=== 5. Verificación de empaquetado Docker multi-stage ==='
                sh '''
                    docker build -t "admin-proyectos/api-gestor:ci-${BUILD_NUMBER}" ./Ejercicio5MyAPIGestor
                    docker build -t "admin-proyectos/cliente:ci-${BUILD_NUMBER}" ./Ejercicio5Cliente
                '''
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STAGE 7 – Validación de Infraestructura como Código (Terraform)
        // ─────────────────────────────────────────────────────────────────────
        stage('Terraform IaC Validation') {
            steps {
                echo '=== 6. Validación de formato y esquema Terraform (infra/terraform) ==='
                sh '''
                    docker run --rm \
                        --volumes-from jenkins \
                        -w "${WORKSPACE}/infra/terraform" \
                        "${TERRAFORM_IMAGE}" fmt -check -recursive -diff

                    docker run --rm \
                        --volumes-from jenkins \
                        -w "${WORKSPACE}/infra/terraform" \
                        "${TERRAFORM_IMAGE}" init -backend=false -input=false -no-color

                    docker run --rm \
                        --volumes-from jenkins \
                        -w "${WORKSPACE}/infra/terraform" \
                        "${TERRAFORM_IMAGE}" validate -no-color
                '''
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STAGE 8 – OWASP Dependency-Check (Opcional por tiempo de ejecución)
        // ─────────────────────────────────────────────────────────────────────
        stage('OWASP Dependency-Check') {
            when {
                expression { params.RUN_OWASP_CHECK == true }
            }
            steps {
                echo '=== 7. Análisis de Dependencias Vulnerables (OWASP) ==='
                sh '''
                    mkdir -p dependency-check-report
                    docker run --rm \
                        --volumes-from jenkins \
                        -w "${WORKSPACE}" \
                        owasp/dependency-check:latest \
                        --scan "${WORKSPACE}" \
                        --format "ALL" \
                        --project "admin-proyectos" \
                        --out "${WORKSPACE}/dependency-check-report" || true
                '''
                archiveArtifacts artifacts: 'dependency-check-report/*', allowEmptyArchive: true
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STAGE 9 – CD: Despliegue Continuo a Render Cloud (Deploy Hooks)
        // ─────────────────────────────────────────────────────────────────────
        stage('CD – Deploy to Render') {
            when {
                expression { params.DEPLOY_TO_RENDER == true }
            }
            steps {
                echo '=== 8. Disparando Deploy Hooks en Render Cloud ==='
                withCredentials([
                    string(credentialsId: 'render-deploy-hook-api', variable: 'RENDER_DEPLOY_HOOK_API'),
                    string(credentialsId: 'render-deploy-hook-cliente', variable: 'RENDER_DEPLOY_HOOK_CLIENTE')
                ]) {
                    sh '''
                        set -e
                        echo "Activando despliegue de Ejercicio5MyAPIGestor en Render..."
                        curl -fsS -X POST "${RENDER_DEPLOY_HOOK_API}" > /dev/null
                        echo "Deploy Hook API enviado correctamente."

                        echo "Activando despliegue de Ejercicio5Cliente en Render..."
                        curl -fsS -X POST "${RENDER_DEPLOY_HOOK_CLIENTE}" > /dev/null
                        echo "Deploy Hook Cliente enviado correctamente."
                    '''
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // STAGE 10 – Verificación Post-Despliegue (/actuator/health + k6 Smoke)
        // ─────────────────────────────────────────────────────────────────────
        stage('Post-Deploy Health Check & k6 Smoke') {
            when {
                expression { params.DEPLOY_TO_RENDER == true }
            }
            steps {
                echo '=== 9. Verificación post-despliegue (/actuator/health) y Smoke Test k6 ==='
                sh '''
                    set -e
                    if [ -z "${RENDER_API_URL}" ] || [ -z "${RENDER_CLIENT_URL}" ]; then
                        echo "ERROR: RENDER_API_URL y RENDER_CLIENT_URL deben especificarse cuando DEPLOY_TO_RENDER=true."
                        exit 1
                    fi

                    check_health() {
                        SERVICE_NAME="$1"
                        URL="$2/actuator/health"
                        echo "Verificando salud de ${SERVICE_NAME} en ${URL}..."
                        for i in $(seq 1 30); do
                            if curl -fsS --max-time 10 "${URL}" | grep -q '"status":"UP"'; then
                                echo "[OK] ${SERVICE_NAME} reportó status UP (intento ${i})."
                                return 0
                            fi
                            echo "Esperando respuesta UP de ${SERVICE_NAME} (${i}/30)..."
                            sleep 10
                        done
                        echo "[ERROR] ${SERVICE_NAME} no alcanzó estado UP tras el tiempo límite."
                        return 1
                    }

                    check_health "api-gestor" "${RENDER_API_URL}"
                    check_health "cliente" "${RENDER_CLIENT_URL}"
                '''

                script {
                    if (params.RUN_K6_SMOKE) {
                        sh '''
                            mkdir -p performance/reports
                            docker run --rm \
                                --volumes-from jenkins \
                                -w "${WORKSPACE}" \
                                -e API_URL="${RENDER_API_URL}" \
                                -e CLIENT_URL="${RENDER_CLIENT_URL}" \
                                -e TARGET_ENV="render" \
                                "${K6_IMAGE}" run performance/k6/smoke-test.js
                        '''
                        archiveArtifacts artifacts: 'performance/reports/*', allowEmptyArchive: true
                    }
                }
            }
        }
    }

    post {
        always {
            sh '''
                docker rmi "admin-proyectos/api-gestor:ci-${BUILD_NUMBER}" "admin-proyectos/cliente:ci-${BUILD_NUMBER}" || true
            '''
            echo '=== Fin de la ejecución del Pipeline DevOps (Java 21 + IaC + CD) ==='
        }
        success {
            echo '=== Circuito DevOps finalizado con éxito ==='
        }
        failure {
            echo '=== Fallas detectadas durante la ejecución del Circuito DevOps ==='
        }
    }
}
