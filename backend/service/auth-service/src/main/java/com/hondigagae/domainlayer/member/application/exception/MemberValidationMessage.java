package com.hondigagae.domainlayer.member.application.exception;

/**
 * 회원 요청 검증 메시지 카탈로그 (MEMBER_1xx).
 *
 * <p>Bean Validation의 {@code message}는 컴파일 상수만 받을 수 있어 enum을 직접 쓸 수 없다.
 * 코드와 메시지를 이 상수에 모아 DTO가 참조하게 하면, 오타나 삭제를 컴파일러가 잡고
 * 코드-메시지의 단일 기준점이 유지된다.
 *
 * <p>형식: {@code "코드:사용자 메시지"} — ValidationErrorSupport가 접두어를 분리한다.
 */
public final class MemberValidationMessage {

    public static final String EMAIL_REQUIRED = "MEMBER_101:이메일은 필수입니다.";
    public static final String EMAIL_FORMAT_INVALID = "MEMBER_102:이메일 형식이 올바르지 않습니다.";
    public static final String PASSWORD_REQUIRED = "MEMBER_103:비밀번호는 필수입니다.";
    // 길이는 @Size(MEMBER_104), 문자 구성은 @Pattern(MEMBER_105)이 각각 담당한다.
    // 두 메시지가 길이를 함께 언급하면 같은 필드에 중복된 안내가 나가므로 역할을 분리해서 적는다.
    public static final String PASSWORD_LENGTH_INVALID = "MEMBER_104:비밀번호는 8자 이상 20자 이하여야 합니다.";
    public static final String PASSWORD_PATTERN_INVALID =
        "MEMBER_105:비밀번호는 공백 없이 영문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.";
    public static final String NAME_REQUIRED = "MEMBER_106:이름은 필수입니다.";
    public static final String NAME_LENGTH_INVALID = "MEMBER_107:이름은 10자 이하만 가능합니다.";
    public static final String NICKNAME_REQUIRED = "MEMBER_108:닉네임은 필수입니다.";
    public static final String NICKNAME_LENGTH_INVALID = "MEMBER_109:닉네임은 10자 이하만 가능합니다.";
    public static final String PROFILE_IMAGE_URL_LENGTH_INVALID = "MEMBER_110:프로필 이미지 URL은 255자 이하만 가능합니다.";
    public static final String CURRENT_PASSWORD_REQUIRED = "MEMBER_111:현재 비밀번호는 필수입니다.";
    public static final String NEW_PASSWORD_REQUIRED = "MEMBER_112:새 비밀번호는 필수입니다.";
    // 113·114는 MemberErrorCode 의 PARAMETER_TYPE_INVALID/PARAMETER_REQUIRED 가 이미 쓰고 있다.
    // 같은 대역을 공유하므로 번호를 재사용하지 않고 115부터 이어 붙인다.
    public static final String TERMS_AGREEMENT_REQUIRED = "MEMBER_115:이용약관에 동의해야 가입할 수 있습니다.";
    public static final String PRIVACY_AGREEMENT_REQUIRED = "MEMBER_116:개인정보 처리방침에 동의해야 가입할 수 있습니다.";

    /** 비밀번호 문자 구성 규칙. 길이는 @Size 가 담당하므로 여기서는 구성만 본다 (§8-2 중복 검사 금지). */
    public static final String PASSWORD_REGEXP = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[!@#$%^&*()\\-_=+\\[\\]{};:'\",.<>/?\\\\|])\\S+$";

    private MemberValidationMessage() {
    }
}
