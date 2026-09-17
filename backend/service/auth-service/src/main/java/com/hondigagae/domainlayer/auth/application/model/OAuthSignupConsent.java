package com.hondigagae.domainlayer.auth.application.model;

/**
 * 소셜 최초 연동(= 신규 가입)에 쓰는 동의 플래그.
 *
 * <p>이 값은 {@code /authorize} 시점에 받아 state 와 함께 보관했다가 콜백에서 꺼내 쓴다.
 * 콜백에서 다시 받지 않는 이유는 <b>OAuth 인가코드가 1회용</b>이기 때문이다 — 콜백에서
 * 동의 누락으로 거부하면 같은 코드로는 재시도할 수 없고, 사용자는 provider 인가 화면부터
 * 다시 밟아야 한다.
 *
 * <p>{@code info} 가 아니라 {@code model} 에 두는 이유 — 이 저장소에서 {@code info} 는
 * "Presenter 가 Response 로 바꿔 줄 값"을 뜻한다. 이 타입은 응답으로 나가지 않고 Controller
 * 입력부터 out-port 계약까지 네 경계를 통과하는 <b>애플리케이션 내부 값</b>이라,
 * out-port 에 박히면 안 되는 {@code info} 와 성격이 다르다 (architecture-guide §4).
 *
 * <p>이미 가입한 회원의 로그인에는 쓰이지 않으므로 기본값은 전부 {@code false} 여도 된다.
 */
public record OAuthSignupConsent(boolean termsAgreed, boolean privacyAgreed) {

    private static final OAuthSignupConsent NONE = new OAuthSignupConsent(false, false);

    /** 동의를 받지 않은 상태. 기존 회원 로그인 경로에서만 유효하다. */
    public static OAuthSignupConsent none() {
        return NONE;
    }

    /** 필수 동의를 모두 받았는지. 신규 회원 생성 직전에만 묻는다. */
    public boolean agreedAll() {
        return termsAgreed && privacyAgreed;
    }
}
