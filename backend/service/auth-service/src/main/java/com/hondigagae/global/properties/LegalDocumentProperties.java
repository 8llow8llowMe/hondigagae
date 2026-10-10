package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 가입 시 동의받는 법적 문서의 현재 버전.
 *
 * <p><b>값의 정본은 프론트다.</b> 실제 약관/방침 본문과 버전은
 * {@code frontend/src/lib/legal/terms-of-service.ts} 의 {@code version} 과
 * {@code frontend/src/lib/legal/privacy-policy.ts} 의 {@code version} 에 있고, 여기 설정값은
 * 그 값을 그대로 따라 적는 사본이다. 백엔드는 본문을 갖고 있지 않으므로 이 값이 어긋나면
 * <b>"회원이 무엇에 동의했는가"가 틀어진다</b> — 화면에는 1.1 을 보여주고 이력에는 1.0 이
 * 남는 식이다. 문서를 개정할 때는 프론트 상수와 이 설정을 같은 배포에 함께 올린다.
 *
 * <p>기본값을 둔 이유 — 운영에서도 버전이 비어 가입 전체가 죽는 것보다, 직전 버전으로라도
 * 이력이 남는 편이 낫다.
 */
@ConfigurationProperties(prefix = "legal")
public record LegalDocumentProperties(String termsVersion, String privacyVersion) {

}
