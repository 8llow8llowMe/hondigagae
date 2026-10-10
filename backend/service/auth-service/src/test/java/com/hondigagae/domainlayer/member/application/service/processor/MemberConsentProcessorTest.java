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
        // 두 버전을 일부러 다르게 둔다 — 한 값을 여러 항목에 복사하는 실수를 값이 같으면 못 잡는다.
        // 특히 AGE_OVER_14 에 처리방침 버전을 박는 실수는 두 값이 같으면 영원히 드러나지 않는다.
        processor = new MemberConsentProcessor(
            consentRepositoryPort, new SnowflakeIdGenerator(1, 1),
            new LegalDocumentProperties(TERMS_VERSION, PRIVACY_VERSION));
    }

    @Test
    @DisplayName("필수 동의·확인 3건을 설정된 문서 버전으로 남긴다")
    void recordsRequiredConsentsWithConfiguredVersions() {
        processor.recordSignupConsents(MEMBER_ID);

        assertThat(consentRepositoryPort.saved)
            .extracting(MemberConsent::memberId, MemberConsent::type, MemberConsent::documentVersion)
            .containsExactly(
                tuple(MEMBER_ID, ConsentType.TERMS_OF_SERVICE, TERMS_VERSION),
                tuple(MEMBER_ID, ConsentType.PRIVACY_POLICY, PRIVACY_VERSION),
                tuple(MEMBER_ID, ConsentType.AGE_OVER_14, TERMS_VERSION));
    }

    @Test
    @DisplayName("만 14세 이상 확인에는 근거 문서인 이용약관 버전을 박는다")
    void stampsTermsVersionOnAgeConfirmation() {
        // 만 14세 미만 가입 불가를 규정하는 것은 이용약관이다. 처리방침 버전을 박으면 나중에
        // "그때 그 조항이 어떤 문장이었는가"를 복원할 때 엉뚱한 문서를 펼치게 된다.
        processor.recordSignupConsents(MEMBER_ID);

        assertThat(consentRepositoryPort.saved)
            .filteredOn(consent -> consent.type() == ConsentType.AGE_OVER_14)
            .singleElement()
            .extracting(MemberConsent::documentVersion)
            .isEqualTo(TERMS_VERSION);
    }

    @Test
    @DisplayName("한 화면에서 함께 동의했다는 사실이 남도록 항목 간 시각이 같다")
    void recordsEveryConsentAtTheSameInstant() {
        processor.recordSignupConsents(MEMBER_ID);

        assertThat(consentRepositoryPort.saved).hasSize(3);
        assertThat(consentRepositoryPort.saved)
            .extracting(MemberConsent::agreedAt)
            .containsOnly(consentRepositoryPort.saved.get(0).agreedAt());
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

        @Override
        public void deleteAllByMemberIdIn(List<Long> memberIds) {
            saved.removeIf(consent -> memberIds.contains(consent.memberId()));
        }
    }
}
