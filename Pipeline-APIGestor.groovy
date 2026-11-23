// Pipeline CI individual – Ejercicio5MyAPIGestor (Java 21)
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
                echo '=== Descargando código del repositorio (Ejercicio5MyAPIGestor) ==='
                checkout scm
            }
        }

        stage('Build & Test (Java 21)') {
            steps {
                echo '=== Compilando con Java 21 y ejecutando pruebas unitarias ==='
                dir('Ejercicio5MyAPIGestor') {
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
                    execPattern: 'Ejercicio5MyAPIGestor/target/jacoco.exec',
                    classPattern: 'Ejercicio5MyAPIGestor/target/classes',
                    sourcePattern: 'Ejercicio5MyAPIGestor/src/main/java',
                    minimumInstructionCoverage: '80'
                )
            }
        }

        stage('SonarQube Analysis') {
            steps {
                echo '=== Ejecutando análisis estático con SonarQube ==='
                withSonarQubeEnv('SonnarServer') {
                    dir('Ejercicio5MyAPIGestor') {
                        sh '''
                            "$MAVEN_HOME/bin/mvn" \
                                org.sonarsource.scanner.maven:sonar-maven-plugin:5.5.0.6356:sonar \
                                -Dsonar.host.url="${SONAR_HOST_URL}" \
                                -Dsonar.token="${SONAR_AUTH_TOKEN}" \
                                -Dsonar.projectKey=Ejercicio5MyAPIGestor \
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
                            --output=reportes/semgrep-apigestor.json \
                            Ejercicio5MyAPIGestor
                '''
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'reportes/semgrep-apigestor.json',
                             allowEmptyArchive: true,
                             fingerprint: true
            echo '=== Fin del Pipeline de Ejercicio5MyAPIGestor ==='
        }
        success {
            echo '=== Pipeline finalizado con éxito (Java 21, SonarQube y Semgrep OK) ==='
        }
        failure {
            echo '=== Fallas detectadas durante la ejecución ==='
        }
    }
}
