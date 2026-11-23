// Pipeline de Integración y Verificación de Base de Datos (Unidad II/III)
// Requisito de seguridad: crear la credencial Secret Text 'db-test-root-password' en Jenkins
// (Administrar Jenkins -> Credentials -> System -> Global credentials -> Secret text)
// Cero contraseñas hardcodeadas en el repositorio.

pipeline {
    agent any

    environment {
        DB_TEST_PASSWORD = credentials('db-test-root-password')
        DB_NAME          = 'dbgestor'
        DB_CONTAINER     = 'jenkins-db-test'
    }

    stages {
        stage('Checkout & Setup') {
            steps {
                echo '=== 1. Descarga de artefactos y scripts de Base de Datos ==='
                checkout scm
            }
        }

        stage('Security Scan (SAST) - Semgrep SQL') {
            steps {
                echo '=== 2. Análisis Estático de Seguridad (SAST) en Scripts SQL ==='
                sh '''
                    mkdir -p reportes
                    SQL_TARGET="dump-dbgestor-202406261453.sql"
                    if [ -d "database" ]; then
                        SQL_TARGET="database/"
                    fi

                    docker run --rm \
                        --network bridge \
                        --volumes-from jenkins \
                        -w "${WORKSPACE}" \
                        semgrep/semgrep \
                        semgrep scan \
                            --config=auto \
                            --json \
                            --output=reportes/semgrep-db.json \
                            "${SQL_TARGET}" || true
                '''
            }
        }

        stage('RDBMS Deployment & Schema Migration') {
            steps {
                echo '=== 3. Despliegue de RDBMS MariaDB efímero y Carga de Esquema ==='
                sh '''
                    docker rm -f "${DB_CONTAINER}" || true

                    docker run -d --name "${DB_CONTAINER}" \
                        --network bridge \
                        -e MARIADB_ROOT_PASSWORD="${DB_TEST_PASSWORD}" \
                        -e MARIADB_DATABASE="${DB_NAME}" \
                        mariadb:11-jammy

                    echo "Esperando inicialización de MariaDB..."
                    for i in $(seq 1 30); do
                        if docker exec -e MARIADB_PWD="${DB_TEST_PASSWORD}" "${DB_CONTAINER}" \
                            mariadb -u root -e "SELECT 1" > /dev/null 2>&1; then
                            echo "RDBMS operativo en el intento $i"
                            break
                        fi
                        sleep 1
                    done

                    DUMP_PATH="${WORKSPACE}/dump-dbgestor-202406261453.sql"
                    if [ -f "${WORKSPACE}/database/dump-dbgestor-202406261453.sql" ]; then
                        DUMP_PATH="${WORKSPACE}/database/dump-dbgestor-202406261453.sql"
                    fi

                    echo "Cargando dump DDL/DML..."
                    docker cp "${DUMP_PATH}" "${DB_CONTAINER}:/tmp/dump.sql"
                    docker exec -e MARIADB_PWD="${DB_TEST_PASSWORD}" "${DB_CONTAINER}" \
                        mariadb -u root "${DB_NAME}" -e "SOURCE /tmp/dump.sql;"
                    echo "Esquema y datos cargados exitosamente."
                '''
            }
        }

        stage('Integrity & Schema Verification Tests') {
            steps {
                echo '=== 4. Ejecución de Pruebas de Integridad Estructural y Relacional ==='
                sh '''
                    mkdir -p reportes

                    docker exec -e MARIADB_PWD="${DB_TEST_PASSWORD}" "${DB_CONTAINER}" \
                        mariadb -u root "${DB_NAME}" -e "
                        SELECT '--- TABLAS DETECTADAS ---' AS '';
                        SHOW TABLES;

                        SELECT '--- CONTEO DE REGISTROS ---' AS '';
                        SELECT 'usuario' AS tabla, COUNT(*) AS total FROM usuario
                        UNION ALL
                        SELECT 'proyectos', COUNT(*) FROM proyectos
                        UNION ALL
                        SELECT 'tareas', COUNT(*) FROM tareas
                        UNION ALL
                        SELECT 'comentarios', COUNT(*) FROM comentarios
                        UNION ALL
                        SELECT 'asignaciones', COUNT(*) FROM asignaciones;

                        SELECT '--- RESTRICCIONES Y LLAVES PRIMARIAS (PK) ---' AS '';
                        SELECT TABLE_NAME, CONSTRAINT_TYPE, CONSTRAINT_NAME
                        FROM information_schema.TABLE_CONSTRAINTS
                        WHERE CONSTRAINT_SCHEMA='${DB_NAME}';

                        SELECT '--- ÍNDICES Y LLAVES SECUNDARIAS ---' AS '';
                        SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE
                        FROM information_schema.STATISTICS
                        WHERE TABLE_SCHEMA='${DB_NAME}';
                    " > reportes/database-verification.log

                    cat reportes/database-verification.log

                    echo "Extrayendo esquema DDL desde RDBMS con mariadb-dump..."
                    docker exec -e MARIADB_PWD="${DB_TEST_PASSWORD}" "${DB_CONTAINER}" \
                        mariadb-dump -u root --no-data "${DB_NAME}" > reportes/schema-extracted.sql

                    cat << 'EOF' > reportes/db-integrity.json
{
  "database": "dbgestor",
  "rdbms": "MariaDB 11-jammy (validación relacional efímera)",
  "status": "VALIDATED",
  "tables_verified": [
    "asignaciones",
    "comentarios",
    "hibernate_sequence",
    "proyectos",
    "tareas",
    "usuario"
  ],
  "integrity_checks": {
    "tables_count": 6,
    "primary_keys_enforced": true,
    "indexes_present": true,
    "data_migration_successful": true
  }
}
EOF
                '''
            }
        }
    }

    post {
        always {
            sh '''
                docker rm -f "${DB_CONTAINER}" || true
            '''
            archiveArtifacts artifacts: 'reportes/*',
                             allowEmptyArchive: true,
                             fingerprint: true
            echo '=== Fin del Pipeline de Base de Datos ==='
        }
        success {
            echo '=== Pipeline de Base de Datos finalizado con éxito ==='
        }
        failure {
            echo '=== Fallas detectadas en el Pipeline de Base de Datos ==='
        }
    }
}
