package com.hondigagae.domainlayer.member.application.service.processor;

import com.hondigagae.domainlayer.member.application.port.out.MemberConsentRepositoryPort;
import com.hondigagae.domainlayer.member.domain.enums.ConsentType;
import com.hondigagae.domainlayer.member.domain.model.MemberConsent;
import com.hondigagae.global.properties.LegalDocumentProperties;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 가입 동의 이력을 남기는 단일 지점.
 *
 * <p>가입 경로가 셋(일반 · 개발용 즉시 · 소셜 최초 연동)인데 <b>동의 규칙은 하나여야 한다</b> —
 * 필수 항목이 무엇인지, 어느 버전을 박제하는지, 항목 간 시각을 어떻게 맞추는지. 경로마다 복제해
 * 두면 선택 동의 하나가 추가되는 날 일반 가입에는 3행, 소셜에는 2행이 남는 상태가 조용히
 * 생긴다. 그 어긋남은 가입 시점에는 아무 증상이 없고, 한참 뒤 이력을 읽을 때 드러난다.
 *
 * <p><b>트랜잭션을 스스로 열지 않는다 — 호출자 트랜잭션에 합류한다.</b> 회원 행과 동의 행은
 * 반드시 같은 트랜잭션이어야 하는데(하나만 남으면 "동의 없는 회원" 또는 "회원 없는 동의"가
 * 된다) 그 경계는 호출자마다 다른 곳에 있다 — {@code MemberWebFacade},
 * {@code MemberDevSignupFacade}, {@code OAuthLoginProcessor.login}. 여기에
 * {@code @Transactional} 을 붙이면 기본 전파(REQUIRED)로 합류하긴 하지만, "이 클래스가 자기
 * 경계를 갖는다"는 잘못된 신호를 남기고 누군가 전파 속성을 바꾸는 순간 회원과 동의가 갈라진다.
 *
 * <p>같은 이유로 이 책임을 Facade 로 올리지 않았다. {@code AuthWebFacade.oauthLogin} 은 외부
 * HTTP 왕복 때문에 <b>의도적으로</b> 트랜잭션이 없어서, 거기서 호출하면 회원은 커밋됐는데 동의
 * 이력은 사라지는 경우가 생긴다.
 */
@Service
@RequiredArgsConstructor
public class MemberConsentProcessor {

    private final MemberConsentRepositoryPort memberConsentRepositoryPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;
    private final LegalDocumentProperties legalDocumentProperties;

    /**
     * 가입 시 받는 필수 동의 전부를 <b>같은 시각</b>으로 한 번에 남긴다. 항목별로 시각이 갈리면
     * "한 화면에서 함께 동의했다"는 사실이 이력에서 사라진다.
     *
     * <p>동의 여부 자체는 여기서 묻지 않는다 — 이 메서드에 닿았다는 것은 호출자가 이미 필수 동의를
     * 확인했다는 뜻이다. 확인 책임을 가입 경로에 두는 이유는 경로마다 거부 방식이 다르기 때문이다
     * (일반 가입은 요청 검증, 소셜은 콜백에서 {@code MEMBER_010}).
     */
    public void recordSignupConsents(long memberId) {
        LocalDateTime agreedAt = LocalDateTime.now();
        memberConsentRepositoryPort.saveAll(List.of(
            consent(memberId, ConsentType.TERMS_OF_SERVICE, legalDocumentProperties.termsVersion(), agreedAt),
            consent(memberId, ConsentType.PRIVACY_POLICY, legalDocumentProperties.privacyVersion(), agreedAt)));
    }

    private MemberConsent consent(long memberId, ConsentType type, String documentVersion, LocalDateTime agreedAt) {
        return MemberConsent.builder()
            .id(snowflakeIdGenerator.generateId())
            .memberId(memberId)
            .type(type)
            .documentVersion(documentVersion)
            .agreedAt(agreedAt)
            .build();
    }
}
