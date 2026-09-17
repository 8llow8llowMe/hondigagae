package com.hondigagae.domainlayer.member.application.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.global.properties.WithdrawnEmailProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 탈퇴 이메일 다이제스트.
 *
 * <p>여기서 지키는 불변식은 하나다 — <b>같은 이메일은 언제 계산해도 같은 다이제스트가 된다.</b>
 * 이게 깨지면 재가입 차단이 조용히 뚫린다. 특히 대소문자·공백 차이가 다른 값으로 계산되면,
 * 사용자가 " Tester@Example.com " 으로 다시 가입할 때 아무도 못 막는다.
 */
class WithdrawnEmailHasherTest {

    private static final String PEPPER = "withdrawn-email-hasher-test-pepper-0123456789";

    private WithdrawnEmailHasher hasher;

    @BeforeEach
    void setUp() {
        hasher = new WithdrawnEmailHasher(new WithdrawnEmailProperties(PEPPER));
    }

    @Test
    @DisplayName("같은 이메일은 항상 같은 다이제스트가 된다")
    void sameEmailProducesSameDigest() {
        assertThat(hasher.hash("tester@example.com")).isEqualTo(hasher.hash("tester@example.com"));
    }

    @Test
    @DisplayName("대소문자와 앞뒤 공백 차이는 같은 다이제스트로 정규화된다")
    void normalizesCaseAndWhitespace() {
        String expected = hasher.hash("tester@example.com");

        assertThat(hasher.hash("  Tester@Example.COM  ")).isEqualTo(expected);
        assertThat(hasher.hash("TESTER@EXAMPLE.COM")).isEqualTo(expected);
    }

    @Test
    @DisplayName("다른 이메일은 다른 다이제스트가 된다")
    void differentEmailsProduceDifferentDigests() {
        assertThat(hasher.hash("tester@example.com")).isNotEqualTo(hasher.hash("other@example.com"));
    }

    @Test
    @DisplayName("결과는 hex 64자다 — email 컬럼(length 100)에 그대로 들어간다")
    void producesSixtyFourHexCharacters() {
        assertThat(hasher.hash("tester@example.com")).hasSize(64).matches("[0-9a-f]{64}");
    }

    @Test
    @DisplayName("원문이 다이제스트에서 드러나지 않는다 — @ 가 없어 마이그레이션 판별의 근거가 된다")
    void digestContainsNoRawEmail() {
        String digest = hasher.hash("tester@example.com");

        assertThat(digest).doesNotContain("@").doesNotContain("tester").doesNotContain("example");
    }

    @Test
    @DisplayName("pepper 가 다르면 같은 이메일도 다른 다이제스트가 된다 — 그래서 바꾸면 안 된다")
    void differentPepperProducesDifferentDigest() {
        WithdrawnEmailHasher other = new WithdrawnEmailHasher(
            new WithdrawnEmailProperties("another-pepper-that-is-long-enough-0123456789"));

        assertThat(other.hash("tester@example.com")).isNotEqualTo(hasher.hash("tester@example.com"));
    }

    @Test
    @DisplayName("같은 pepper 는 같은 지문이다 — 배포 전후 기동 로그를 비교하는 근거")
    void samePepperProducesSameFingerprint() {
        WithdrawnEmailHasher sameHasher = new WithdrawnEmailHasher(new WithdrawnEmailProperties(PEPPER));

        assertThat(sameHasher.fingerprint()).isEqualTo(hasher.fingerprint());
    }

    @Test
    @DisplayName("pepper 가 바뀌면 지문도 바뀐다 — 조용히 뚫리는 교체를 사후에 알아채는 유일한 수단")
    void differentPepperProducesDifferentFingerprint() {
        WithdrawnEmailHasher other = new WithdrawnEmailHasher(
            new WithdrawnEmailProperties("another-pepper-that-is-long-enough-0123456789"));

        assertThat(other.fingerprint()).isNotEqualTo(hasher.fingerprint());
    }

    @Test
    @DisplayName("지문은 hex 8자이고 어떤 이메일의 다이제스트도 아니다 — 로그에 남아도 안전하다")
    void fingerprintIsShortHexAndNotAnEmailDigest() {
        assertThat(hasher.fingerprint()).hasSize(8).matches("[0-9a-f]{8}");
        // 지문의 입력은 이메일이 아니다. 특정 사용자의 다이제스트 앞자리가 로그로 새면 안 된다.
        assertThat(hasher.hash("tester@example.com")).doesNotStartWith(hasher.fingerprint());
    }

    @Test
    @DisplayName("pepper 가 비었거나 짧으면 생성 시점에 실패한다 — 비밀 없이 도는 해시를 막는다")
    void rejectsMissingOrShortPepper() {
        assertThatThrownBy(() -> new WithdrawnEmailHasher(new WithdrawnEmailProperties(null)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("WITHDRAWN_EMAIL_PEPPER");

        assertThatThrownBy(() -> new WithdrawnEmailHasher(new WithdrawnEmailProperties("")))
            .isInstanceOf(IllegalStateException.class);

        assertThatThrownBy(() -> new WithdrawnEmailHasher(new WithdrawnEmailProperties("too-short")))
            .isInstanceOf(IllegalStateException.class);

        // 공백만 채운 값도 빈 값과 같이 본다 — 설정 실수의 가장 흔한 모양이다.
        assertThatThrownBy(() -> new WithdrawnEmailHasher(new WithdrawnEmailProperties("        ")))
            .isInstanceOf(IllegalStateException.class);
    }
}
