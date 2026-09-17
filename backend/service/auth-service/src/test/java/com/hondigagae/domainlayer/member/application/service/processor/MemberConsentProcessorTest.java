package com.hondigagae.domainlayer.member.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.hondigagae.domainlayer.member.application.port.out.MemberConsentRepositoryPort;
import com.hondigagae.domainlayer.member.domain.enums.ConsentType;
import com.hondigagae.domainlayer.member.domain.model.MemberConsent;
import com.hondigagae.global.properties.LegalDocumentProperties;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 동의 이력 <b>내용</b>의 단일 기준점.
 *
 * <p>가입 경로가 셋이라도 남는 이력은 하나의 규칙을 따라야 한다. 그 규칙(필수 항목이 무엇인지,
 * 어느 버전을 박제하는지, 항목 간 시각을 어떻게 맞추는지)은 여기서만 검증한다 — 경로별 테스트에
 * 흩어 두면 항목이 늘어날 때 한쪽만 고쳐지고, 그게 바로 이 클래스를 추출한 이유다.
 * 경로별 테스트는 "이 프로세서를 부르는가"와 "언제 부르지 않는가"만 본다.
 */
class MemberConsentProcessorTest {

    private static final long MEMBER_ID = 42L;
    private static final String TERMS_VERSION = "1.0";
    private static final String PRIVACY_VERSION = "1.2";

    private RecordingConsentRepositoryPort consentRepositoryPort;
    private MemberConsentProcessor processor;

    @BeforeEach
    void setUp() {
        consentRepositoryPort = new RecordingConsentRepositoryPort();
        // 두 버전을 일부러 다르게 둔다 — 한 값을 두 항목에 복사하는 실수를 값이 같으면 못 잡는다.
        processor = new MemberConsentProcessor(
            consentRepositoryPort, new SnowflakeIdGenerator(1, 1),
            new LegalDocumentProperties(TERMS_VERSION, PRIVACY_VERSION));
    }

    @Test
    @DisplayName("필수 동의 2건을 설정된 문서 버전으로 남긴다")
    void recordsRequiredConsentsWithConfiguredVersions() {
        processor.recordSignupConsents(MEMBER_ID);

        assertThat(consentRepositoryPort.saved)
            .extracting(MemberConsent::memberId, MemberConsent::type, MemberConsent::documentVersion)
            .containsExactly(
                tuple(MEMBER_ID, ConsentType.TERMS_OF_SERVICE, TERMS_VERSION),
                tuple(MEMBER_ID, ConsentType.PRIVACY_POLICY, PRIVACY_VERSION));
    }

    @Test
    @DisplayName("한 화면에서 함께 동의했다는 사실이 남도록 항목 간 시각이 같다")
    void recordsEveryConsentAtTheSameInstant() {
        processor.recordSignupConsents(MEMBER_ID);

        assertThat(consentRepositoryPort.saved).hasSize(2);
        assertThat(consentRepositoryPort.saved.get(0).agreedAt())
            .isEqualTo(consentRepositoryPort.saved.get(1).agreedAt());
    }

    @Test
    @DisplayName("이력마다 고유한 아이디를 받는다")
    void assignsDistinctIds() {
        processor.recordSignupConsents(MEMBER_ID);

        assertThat(consentRepositoryPort.saved).extracting(MemberConsent::id).doesNotHaveDuplicates();
        assertThat(consentRepositoryPort.saved).allSatisfy(consent -> assertThat(consent.id()).isPositive());
    }

    @Test
    @DisplayName("한 번의 호출이 한 번의 벌크 저장이 된다")
    void savesInASingleBatch() {
        // 단건 save 반복으로 되돌아가면 가입 경로에 루프 안 포트 호출이 생긴다 (§9-7).
        processor.recordSignupConsents(MEMBER_ID);

        assertThat(consentRepositoryPort.saveAllCalls).isEqualTo(1);
    }

    private static class RecordingConsentRepositoryPort implements MemberConsentRepositoryPort {

        private final List<MemberConsent> saved = new ArrayList<>();
        private int saveAllCalls;

        @Override
        public void saveAll(List<MemberConsent> consents) {
            saveAllCalls++;
            saved.addAll(consents);
        }
    }
}
