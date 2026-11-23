// Pipeline CI individual – Ejercicio5Cliente (Java 21)
// Seguridad: las credenciales de SonarQube se inyectan exclusivamente vía withSonarQubeEnv('SonnarServer').
// Cero secretos hardcodeados en el repositorio.

pipeline {
    agent any

    tools {
        maven 'Maven21'
        jdk 'JDK21'
    }

    stages {
        stage('Checkout') {
            steps {
                echo '=== Descargando código del repositorio (Ejercicio5Cliente) ==='
                checkout scm
            }
        }

        stage('Build & Test (Java 21)') {
            steps {
                echo '=== Compilando con Java 21 y ejecutando pruebas unitarias ==='
                dir('Ejercicio5Cliente') {
                    sh '''
                        "$MAVEN_HOME/bin/mvn" clean verify -Dsurefire.useFile=false
                    '''
                }
            }
        }

        stage('JaCoCo Coverage') {
            steps {
                echo '=== Publicando reporte de cobertura JaCoCo (>= 80%) ==='
                jacoco(
                    execPattern: 'Ejercicio5Cliente/target/jacoco.exec',
                    classPattern: 'Ejercicio5Cliente/target/classes',
                    sourcePattern: 'Ejercicio5Cliente/src/main/java',
                    minimumInstructionCoverage: '80'
                )
            }
        }

        stage('SonarQube Analysis') {
            steps {
                echo '=== Ejecutando análisis estático con SonarQube ==='
                withSonarQubeEnv('SonnarServer') {
                    dir('Ejercicio5Cliente') {
                        sh '''
                            "$MAVEN_HOME/bin/mvn" \
                                org.sonarsource.scanner.maven:sonar-maven-plugin:5.5.0.6356:sonar \
                                -Dsonar.host.url="${SONAR_HOST_URL}" \
                                -Dsonar.token="${SONAR_AUTH_TOKEN}" \
                                -Dsonar.projectKey=Ejercicio5Cliente \
                                -Dsonar.coverage.jacoco.xmlReportPaths=target/site/jacoco/jacoco.xml
                        '''
                    }
                }
            }
        }

        stage('Security Scan (SAST) - Semgrep') {
            steps {
                echo '=== Ejecutando análisis SAST con Semgrep ==='
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
                            --output=reportes/semgrep-cliente.json \
                            Ejercicio5Cliente
                '''
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'reportes/semgrep-cliente.json',
                             allowEmptyArchive: true,
                             fingerprint: true
            echo '=== Fin del Pipeline de Ejercicio5Cliente ==='
        }
        success {
            echo '=== Pipeline finalizado con éxito (Java 21, SonarQube y Semgrep OK) ==='
        }
        failure {
            echo '=== Fallas detectadas durante la ejecución ==='
        }
    }
}
