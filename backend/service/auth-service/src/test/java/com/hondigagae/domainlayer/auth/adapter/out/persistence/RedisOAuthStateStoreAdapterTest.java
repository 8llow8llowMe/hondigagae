package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthStateQueryResult;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * state 직렬화 형식이 <b>늘어난 배포 직후</b>의 동작을 고정한다.
 *
 * <p>state TTL 이 10분이라, 새 형식을 내보낸 뒤 10분 동안은 구버전이 저장한 JSON 이 Redis 에
 * 남아 있다. 그 값이 어떻게 해석되는지가 "가입이 막히느냐 뚫리느냐"를 가르므로 여기서 못 박는다.
 *
 * <p><b>고정하는 것은 Jackson 기본 동작이다.</b> 아래는 앱이 주입받는 매퍼가 아니라 맨
 * {@code ObjectMapper} 라, 누가 {@code spring.jackson.*} 을 켜도 이 테스트는 초록으로 남는다.
 * 그래도 되는 이유는 <b>결과의 방향이 설정에 의존하지 않기</b> 때문이다 — 필드가 누락되면
 * primitive 가 {@code false} 로 채워져 거부되고, {@code fail-on-null-for-primitives} 를 켜면
 * 역직렬화가 터져 무효 state 로 떨어진다. 어느 쪽이든 닫히는 방향이고, <b>누락된 primitive
 * boolean 을 {@code true} 로 채우는 Jackson 설정은 없다.</b> 설정까지 함께 묶으려면
 * {@code @JsonTest} 로 주입 매퍼를 받아야 한다.
 *
 * <p>Redis 왕복은 이 테스트의 관심사가 아니라 해석 부분만 떼어 검증한다 —
 * {@code RedisTemplate}/{@code RedisProperties} 는 이 경로에서 쓰이지 않는다.
 */
class RedisOAuthStateStoreAdapterTest {

    private final RedisOAuthStateStoreAdapter adapter =
        new RedisOAuthStateStoreAdapter(null, null, new ObjectMapper());

    @Test
    @DisplayName("#607 형식(만 14세 필드 없음) state 는 확인받지 않은 것으로 읽힌다")
    void treatsLegacyStateAsNotAgeConfirmed() {
        // 묻지 않은 확인을 받았다고 칠 수는 없다. 이 값이 true 로 읽히면 배포 직후 10분 동안
        // 만 14세 확인 없이 소셜 가입이 뚫린다.
        String legacy = "{\"provider\":\"KAKAO\",\"termsAgreed\":true,\"privacyAgreed\":true}";

        OAuthStateQueryResult result = adapter.deserialize(legacy).orElseThrow();

        assertThat(result.provider()).isEqualTo(OAuthProvider.KAKAO);
        assertThat(result.consent().termsAgreed()).isTrue();
        assertThat(result.consent().privacyAgreed()).isTrue();
        assertThat(result.consent().ageOver14Confirmed()).isFalse();
        assertThat(result.consent().agreedAll()).isFalse();
    }

    @Test
    @DisplayName("현재 형식은 세 값을 그대로 복원한다")
    void restoresCurrentFormat() {
        String current = "{\"provider\":\"NAVER\",\"termsAgreed\":true,\"privacyAgreed\":true,\"ageOver14Confirmed\":true}";

        OAuthStateQueryResult result = adapter.deserialize(current).orElseThrow();

        assertThat(result.provider()).isEqualTo(OAuthProvider.NAVER);
        assertThat(result.consent().agreedAll()).isTrue();
    }

    @Test
    @DisplayName("JSON 형식 이전의 맨 문자열 state 는 무효로 떨어진다")
    void rejectsPreJsonState() {
        // 무효 state 로 처리하면 사용자는 인가부터 다시 밟는다. 예외가 위로 새면 콜백이 500 이 된다.
        assertThat(adapter.deserialize("KAKAO")).isEqualTo(Optional.empty());
    }
}
