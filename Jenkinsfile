pipeline {
    agent any

    tools {
        // Usar la instalación de Maven configurada en Jenkins como "Maven21"
        // En Jenkins: Administrar Jenkins → Tools → Maven → Nombre: Maven21
        maven 'Maven21'
        jdk 'JDK21'
    }

    environment {
        SONAR_HOST_URL   = 'http://sonarqube:9000'
        SONAR_TOKEN      = credentials('sonarqube-token')
    }

    stages {

        // ───────────────────────────────────────────────
        // STAGE 1 – Descarga de código
        // ───────────────────────────────────────────────
        stage('Checkout') {
            steps {
                echo '=== 1. Descarga de código de la rama activa ==='
                checkout scm
            }
        }

        // ───────────────────────────────────────────────
        // STAGE 2 – Build + Pruebas + Cobertura 80 %
        //           Ejercicio5Cliente (Java 21)
        // ───────────────────────────────────────────────
        stage('Build & Test – Cliente') {
            steps {
                echo '=== 2a. Compilación y pruebas – Ejercicio5Cliente ==='
                dir('Ejercicio5Cliente') {
                    sh 'mvn clean verify -Djava.version=21'
                }
                // Publicar resultados JaCoCo en el panel de Jenkins
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

        // ───────────────────────────────────────────────
        // STAGE 3 – Build + Pruebas + Cobertura 80 %
        //           Ejercicio5MyAPIGestor (Java 21)
        // ───────────────────────────────────────────────
        stage('Build & Test – APIGestor') {
            steps {
                echo '=== 2b. Compilación y pruebas – Ejercicio5MyAPIGestor ==='
                dir('Ejercicio5MyAPIGestor') {
                    sh 'mvn clean verify -Djava.version=21'
                }
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

        // ───────────────────────────────────────────────
        // STAGE 4 – Análisis SonarQube – Cliente
        // ───────────────────────────────────────────────
        stage('SonarQube Analysis – Cliente') {
            steps {
                echo '=== 3a. Análisis SonarQube – Ejercicio5Cliente ==='
                dir('Ejercicio5Cliente') {
                    sh """
                        mvn sonar:sonar \\
                            -Dsonar.host.url=${SONAR_HOST_URL} \\
                            -Dsonar.token=${SONAR_TOKEN} \\
                            -Dsonar.projectKey=Ejercicio5Cliente \\
                            -Dsonar.projectName='Ejercicio5Cliente' \\
                            -Dsonar.coverage.jacoco.xmlReportPaths=target/site/jacoco/jacoco.xml || true
                    """
                }
            }
        }

        // ───────────────────────────────────────────────
        // STAGE 5 – Análisis SonarQube – APIGestor
        // ───────────────────────────────────────────────
        stage('SonarQube Analysis – APIGestor') {
            steps {
                echo '=== 3b. Análisis SonarQube – Ejercicio5MyAPIGestor ==='
                dir('Ejercicio5MyAPIGestor') {
                    sh """
                        mvn sonar:sonar \\
                            -Dsonar.host.url=${SONAR_HOST_URL} \\
                            -Dsonar.token=${SONAR_TOKEN} \\
                            -Dsonar.projectKey=Ejercicio5MyAPIGestor \\
                            -Dsonar.projectName='Ejercicio5MyAPIGestor' \\
                            -Dsonar.coverage.jacoco.xmlReportPaths=target/site/jacoco/jacoco.xml || true
                    """
                }
            }
        }

        // ───────────────────────────────────────────────
        // STAGE 6 – SAST con Semgrep
        // ───────────────────────────────────────────────
        stage('SAST Scan (Semgrep)') {
            steps {
                echo '=== 4. Escaneo Estático de Seguridad (SAST) con Semgrep ==='
                sh '''
                    docker run --rm -v "${WORKSPACE}:/src" semgrep/semgrep \
                        semgrep scan --config=auto --json -o /src/semgrep-report.json || true
                '''
                archiveArtifacts artifacts: 'semgrep-report.json', allowEmptyArchive: true
            }
        }

        // ───────────────────────────────────────────────
        // STAGE 7 – OWASP Dependency-Check
        // ───────────────────────────────────────────────
        stage('OWASP Dependency-Check') {
            steps {
                echo '=== 5. Análisis de Dependencias Vulnerables (OWASP) ==='
                sh '''
                    mkdir -p dependency-check-report
                    docker run --rm \
                        -v "${WORKSPACE}:/src" \
                        -v "${WORKSPACE}/dependency-check-report:/report" \
                        owasp/dependency-check:latest \
                        --scan /src \
                        --format "ALL" \
                        --project "admin-proyectos" \
                        --out /report || true
                '''
                dependencyCheckPublisher(
                    pattern: 'dependency-check-report/dependency-check-report.xml'
                )
            }
        }
    }

    post {
        always {
            echo '=== Fin de la ejecución del Pipeline (Java 21) ==='
        }
        success {
            echo '=== Pipeline finalizado con éxito – Java 21 homologado ==='
        }
        failure {
            echo '=== Fallas detectadas durante la ejecución del Pipeline ==='
        }
    }
}
