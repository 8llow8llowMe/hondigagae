package com.hondigagae.domainlayer.auth.adapter.in.web.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.auth.adapter.in.web.dto.response.AuthVerificationCodeSendResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import java.lang.reflect.Method;
import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * #1293 의 계약이 Swagger 에 적혀 있는지 고정한다. 프론트는 Swagger 를 계약으로 읽으므로(`fe-api-check`),
 * 헤더 · 필드가 생겼는데 설명에 없으면 화면 쪽은 그 존재를 모른 채 남는다.
 */
class AuthRetryTimingApiDocumentationTest {

    @Test
    @DisplayName("429 를 내는 세 API 의 설명에 Retry-After 헤더가 적혀 있다")
    void rateLimitedOperationsDocumentRetryAfter() {
        assertThat(operationDescription("loginWithCredentials")).contains("Retry-After").contains("AUTH_015");
        assertThat(operationDescription("sendEmailVerificationCode")).contains("Retry-After").contains("AUTH_003").contains("AUTH_016");
        assertThat(operationDescription("sendPasswordResetCode")).contains("Retry-After").contains("AUTH_003").contains("AUTH_016");
    }

    @Test
    @DisplayName("두 send-code 설명에 응답 시간 필드와 가입 여부 무관 원칙이 적혀 있다")
    void sendCodeOperationsDocumentTimingFields() {
        for (String methodName : new String[]{"sendEmailVerificationCode", "sendPasswordResetCode"}) {
            assertThat(operationDescription(methodName))
                .contains("codeExpiresInSeconds")
                .contains("resendAvailableInSeconds")
                .contains("무관");
        }
    }

    @Test
    @DisplayName("응답 DTO 의 모든 필드에 한국어 @Schema 설명과 예시가 있다")
    void responseFieldsHaveSchema() throws NoSuchFieldException {
        RecordComponent[] components = AuthVerificationCodeSendResponse.class.getRecordComponents();
        assertThat(components).extracting(RecordComponent::getName)
            .containsExactly("codeExpiresInSeconds", "resendAvailableInSeconds");
        for (RecordComponent component : components) {
            // @Schema 의 @Target 에 RECORD_COMPONENT 가 없어 컴포넌트가 아니라 필드에 전파된다.
            Schema schema = AuthVerificationCodeSendResponse.class.getDeclaredField(component.getName()).getAnnotation(Schema.class);
            assertThat(schema).as(component.getName()).isNotNull();
            assertThat(schema.description()).as(component.getName()).contains("초");
            assertThat(schema.example()).as(component.getName()).isNotBlank();
        }
    }

    private static String operationDescription(String methodName) {
        Method method = Arrays.stream(AuthWebController.class.getDeclaredMethods())
            .filter(candidate -> candidate.getName().equals(methodName))
            .findFirst()
            .orElseThrow(() -> new AssertionError("no method " + methodName));
        Operation operation = method.getAnnotation(Operation.class);
        assertThat(operation).as(methodName).isNotNull();
        return operation.description();
    }
}
