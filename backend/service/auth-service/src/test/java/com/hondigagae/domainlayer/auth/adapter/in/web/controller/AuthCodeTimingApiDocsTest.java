package com.hondigagae.domainlayer.auth.adapter.in.web.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 실제로 생성되는 OpenAPI 문서가 #1293 계약을 말하는지 고정한다.
 *
 * <p>어노테이션을 리플렉션으로 읽는 대신 {@code /v3/api-docs} 를 받아 본다 — springdoc 이 {@code @ApiResponse}
 * 를 어떻게 합치는지(429 만 선언해도 반환 타입의 200 스키마가 남는지)는 생성 결과를 봐야 알 수 있다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthCodeTimingApiDocsTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private JsonNode docs;

    @BeforeEach
    void loadDocs() throws Exception {
        String body = mockMvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        docs = objectMapper.readTree(body);
    }

    @Test
    @DisplayName("발송 응답 스키마에 두 필드가 설명과 함께 실린다")
    void codeSendResponseSchemaDescribesFields() {
        JsonNode properties = docs.at("/components/schemas/AuthCodeSendResponse/properties");

        assertThat(properties.at("/codeExpiresInSeconds/description").asText()).contains("유효 시간");
        assertThat(properties.at("/resendAvailableInSeconds/description").asText()).contains("다시 발송");
    }

    @Test
    @DisplayName("두 발송 API 의 200 은 발송 응답 스키마를, 429 는 Retry-After 헤더를 문서화한다")
    void sendCodeEndpointsDocumentTimingAndRetryAfter() {
        for (String path : new String[] {"/api/v1/auth/email/send-code", "/api/v1/auth/password/reset/send-code"}) {
            JsonNode responses = docs.path("paths").path(path).path("post").path("responses");

            assertThat(responses.path("200").toString()).as(path).contains("AuthCodeSendResponse");
            assertThat(responses.at("/429/description").asText()).as(path).contains("AUTH_003").contains("AUTH_016");
            assertThat(responses.at("/429/headers/Retry-After/description").asText()).as(path).contains("초");
            assertThat(responses.at("/429/headers/Retry-After/schema").toString()).as(path).contains("integer");
        }
    }

    @Test
    @DisplayName("로그인 429(AUTH_015)도 Retry-After 헤더를 문서화한다")
    void loginDocumentsRetryAfter() {
        JsonNode responses = docs.at("/paths/~1api~1v1~1auth~1login/post/responses");

        assertThat(responses.path("200").isMissingNode()).isFalse();
        assertThat(responses.at("/429/description").asText()).contains("AUTH_015");
        assertThat(responses.at("/429/headers/Retry-After/description").asText()).contains("초");
    }
}
