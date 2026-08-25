package com.hondigagae.common.exception;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.common.dto.Response;
import com.hondigagae.common.dto.ValidationErrorBody;
import com.hondigagae.common.dto.ValidationErrorItem;
import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

class ValidationErrorSupportTest {

    private static final String DEFAULT_CODE = "MEMBER_100";
    private static final String OBJECT_NAME = "signupRequest";

    private record SignupRequest(String email, String password, String nickname) {
    }

    @SuppressWarnings("unused")
    private void handler(SignupRequest request) {
    }

    @Test
    @DisplayName("한 필드에 제약이 여러 개면 필수 → 길이 → 형식 순으로 정렬하고, 필드는 DTO 선언 순서를 따른다")
    void sortsByDeclarationOrderThenConstraintPriority() throws Exception {
        BindingResult bindingResult = bindingResult();
        // 일부러 뒤섞어서 넣는다. Bean Validation은 제약 평가 순서를 보장하지 않는다.
        bindingResult.addError(fieldError("password", "Pattern", "MEMBER_105:문자 구성이 올바르지 않습니다."));
        bindingResult.addError(fieldError("nickname", "NotBlank", "MEMBER_108:닉네임은 필수입니다."));
        bindingResult.addError(fieldError("password", "Size", "MEMBER_104:8자 이상 20자 이하여야 합니다."));
        bindingResult.addError(fieldError("email", "Email", "MEMBER_102:이메일 형식이 올바르지 않습니다."));

        List<ValidationErrorItem> errors = errorsOf(bindingResult);

        assertThat(errors).extracting(ValidationErrorItem::code)
            .containsExactly("MEMBER_102", "MEMBER_104", "MEMBER_105", "MEMBER_108");
        assertThat(errors).extracting(ValidationErrorItem::field)
            .containsExactly("email", "password", "password", "nickname");
    }

    @Test
    @DisplayName("추가 순서가 달라도 같은 결과를 내려 resultCode가 흔들리지 않는다")
    void producesSameResultRegardlessOfInsertionOrder() throws Exception {
        BindingResult first = bindingResult();
        first.addError(fieldError("password", "Size", "MEMBER_104:8자 이상 20자 이하여야 합니다."));
        first.addError(fieldError("password", "Pattern", "MEMBER_105:문자 구성이 올바르지 않습니다."));

        BindingResult second = bindingResult();
        second.addError(fieldError("password", "Pattern", "MEMBER_105:문자 구성이 올바르지 않습니다."));
        second.addError(fieldError("password", "Size", "MEMBER_104:8자 이상 20자 이하여야 합니다."));

        assertThat(resultCodeOf(first)).isEqualTo("MEMBER_104");
        assertThat(resultCodeOf(second)).isEqualTo("MEMBER_104");
        assertThat(errorsOf(first)).isEqualTo(errorsOf(second));
    }

    @Test
    @DisplayName("대표 메시지는 정렬된 첫 오류의 메시지이고 코드 접두어는 제거된다")
    void representativeMessageComesFromFirstSortedError() throws Exception {
        BindingResult bindingResult = bindingResult();
        bindingResult.addError(fieldError("password", "Pattern", "MEMBER_105:문자 구성이 올바르지 않습니다."));
        bindingResult.addError(fieldError("password", "NotBlank", "MEMBER_103:비밀번호는 필수입니다."));

        ValidationErrorBody body = bodyOf(bindingResult);

        assertThat(body.message()).isEqualTo("비밀번호는 필수입니다.");
        assertThat(body.errors().getFirst().code()).isEqualTo("MEMBER_103");
    }

    @Test
    @DisplayName("코드 접두어가 없는 메시지는 호출부가 넘긴 기본 코드를 사용한다")
    void fallsBackToDefaultCodeWhenPrefixMissing() throws Exception {
        BindingResult bindingResult = bindingResult();
        bindingResult.addError(fieldError("email", "Email", "이메일 형식이 올바르지 않습니다."));

        List<ValidationErrorItem> errors = errorsOf(bindingResult);

        assertThat(errors).hasSize(1);
        assertThat(errors.getFirst().code()).isEqualTo(DEFAULT_CODE);
        assertThat(errors.getFirst().message()).isEqualTo("이메일 형식이 올바르지 않습니다.");
    }

    private BindingResult bindingResult() {
        return new BeanPropertyBindingResult(new SignupRequest("bad", "abc", ""), OBJECT_NAME);
    }

    /**
     * Spring이 Bean Validation 실패로 만드는 FieldError 모양을 흉내낸다.
     * codes 의 첫 항목이 {@code "제약명.객체명.필드명"} 이라서 여기서 제약 애노테이션 이름을 뽑는다.
     */
    private FieldError fieldError(String field, String constraint, String message) {
        String[] codes = {constraint + "." + OBJECT_NAME + "." + field, constraint + "." + field, constraint};
        return new FieldError(OBJECT_NAME, field, null, false, codes, null, message);
    }

    private ValidationErrorBody bodyOf(BindingResult bindingResult) throws Exception {
        Method method = getClass().getDeclaredMethod("handler", SignupRequest.class);
        MethodArgumentNotValidException exception =
            new MethodArgumentNotValidException(new MethodParameter(method, 0), bindingResult);

        ResponseEntity<Response<Void>> response = ValidationErrorSupport.toResponse(exception, DEFAULT_CODE);
        Response<Void> payload = response.getBody();
        assertThat(payload).isNotNull();
        return (ValidationErrorBody) payload.dataHeader().resultMessage();
    }

    private List<ValidationErrorItem> errorsOf(BindingResult bindingResult) throws Exception {
        return bodyOf(bindingResult).errors();
    }

    private String resultCodeOf(BindingResult bindingResult) throws Exception {
        Method method = getClass().getDeclaredMethod("handler", SignupRequest.class);
        MethodArgumentNotValidException exception =
            new MethodArgumentNotValidException(new MethodParameter(method, 0), bindingResult);

        ResponseEntity<Response<Void>> response = ValidationErrorSupport.toResponse(exception, DEFAULT_CODE);
        Response<Void> payload = response.getBody();
        assertThat(payload).isNotNull();
        return payload.dataHeader().resultCode();
    }
}
