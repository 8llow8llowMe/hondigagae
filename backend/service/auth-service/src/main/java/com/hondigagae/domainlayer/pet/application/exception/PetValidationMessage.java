package com.hondigagae.domainlayer.pet.application.exception;

/**
 * 반려견 요청 검증 메시지 카탈로그 (PET_1xx).
 *
 * <p>Bean Validation의 {@code message}는 컴파일 상수만 받을 수 있어 enum을 직접 쓸 수 없다.
 * 코드와 메시지를 이 상수에 모아 DTO가 참조하게 하면, 오타나 삭제를 컴파일러가 잡고
 * 코드-메시지의 단일 기준점이 유지된다.
 *
 * <p>형식: {@code "코드:사용자 메시지"} — ValidationErrorSupport가 접두어를 분리한다.
 */
public final class PetValidationMessage {

    public static final String NAME_REQUIRED = "PET_101:반려견 이름은 필수입니다.";
    public static final String NAME_LENGTH_INVALID = "PET_102:반려견 이름은 20자 이하만 가능합니다.";
    public static final String BREED_LENGTH_INVALID = "PET_103:품종은 50자 이하만 가능합니다.";
    public static final String BIRTH_YM_FORMAT_INVALID = "PET_104:생년월은 yyyy-MM 형식이어야 합니다.";
    public static final String SIZE_TYPE_REQUIRED = "PET_105:크기 구분은 필수입니다.";
    public static final String ACTIVITY_LEVEL_REQUIRED = "PET_106:활동량은 필수입니다.";
    public static final String SOCIALITY_REQUIRED = "PET_107:사회성은 필수입니다.";

    public static final String BIRTH_YM_PATTERN = "^\\d{4}-(0[1-9]|1[0-2])$";

    private PetValidationMessage() {
    }
}
