package com.mx.cbtis.controller;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.ui.ExtendedModelMap;
import org.springframework.web.client.RestTemplate;

import com.mx.cbtis.modelo.Proyectos;

@SpringBootTest
@AutoConfigureMockMvc
class GestorControllerConfigAndActuatorTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private GestorController springController;

    @Test
    @DisplayName("CFG-01 Constructor por defecto usa http://localhost:8081")
    void constructorPorDefecto_usaBaseUrlLocal() {
        GestorController ctrl = new GestorController();
        assertEquals("http://localhost:8081", ctrl.getApiBaseUrl());
    }

    @Test
    @DisplayName("CFG-02 URL externa normaliza diagonales finales y se usa en llamadas REST")
    void urlExterna_normalizaYSeUsaEnLlamadas() {
        RestTemplate mockRest = mock(RestTemplate.class);
        Proyectos p = new Proyectos();
        p.setId_proyecto(10);
        when(mockRest.postForObject(eq("https://api-gestor.onrender.com/buscarProyectos"), any(), eq(Proyectos[].class)))
                .thenReturn(new Proyectos[] { p });

        GestorController ctrl = new GestorController(mockRest, "  https://api-gestor.onrender.com///  ");
        assertEquals("https://api-gestor.onrender.com", ctrl.getApiBaseUrl());

        ResponseEntity<Object> response = ctrl.consultarProyectos(new ExtendedModelMap());
        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(mockRest).postForObject(eq("https://api-gestor.onrender.com/buscarProyectos"), any(), eq(Proyectos[].class));
    }

    @Test
    @DisplayName("CFG-03 Valores nulos, vacios o solo diagonales recurren a la URL local segura")
    void urlVaciaONula_usaValorPorDefecto() {
        RestTemplate mockRest = mock(RestTemplate.class);
        assertEquals("http://localhost:8081", new GestorController(mockRest, null).getApiBaseUrl());
        assertEquals("http://localhost:8081", new GestorController(mockRest, "   ").getApiBaseUrl());
        assertEquals("http://localhost:8081", new GestorController(mockRest, "///").getApiBaseUrl());
        assertEquals("https://api.example.com", new GestorController(null, "https://api.example.com").getApiBaseUrl());
    }

    @Test
    @DisplayName("CFG-04 Bean de Spring inyecta api.base-url correctamente")
    void springBean_inyectaApiBaseUrl() {
        assertEquals("http://localhost:8081", springController.getApiBaseUrl());
    }

    @Test
    @DisplayName("OBS-01 Actuator /actuator/health y probes liveness/readiness responden UP")
    void actuatorHealth_respondeUp() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("OBS-02 Actuator /actuator/info expone metadatos de la aplicacion")
    void actuatorInfo_exponeMetadatos() throws Exception {
        mockMvc.perform(get("/actuator/info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.app.name").value("Ejercicio5Cliente"))
                .andExpect(jsonPath("$.app.version").value("1.0.0"));
    }

    @Test
    @DisplayName("OBS-03 Actuator /actuator/metrics y /actuator/prometheus exponen metricas con tag application")
    void actuatorPrometheus_exponeMetricas() throws Exception {
        mockMvc.perform(get("/")).andExpect(status().isOk());

        mockMvc.perform(get("/actuator/metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.names").isArray());

        mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("application=\"Ejercicio5Cliente\"")))
                .andExpect(content().string(containsString("http_server_requests_seconds_bucket")));
    }
}
