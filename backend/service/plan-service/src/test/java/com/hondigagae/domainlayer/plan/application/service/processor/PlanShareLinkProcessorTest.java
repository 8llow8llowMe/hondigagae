package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.info.PlanShareLinkInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanShareLinkRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanShareLink;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.data.domain.Slice;

/**
 * 공유 링크의 발급·만료·폐기 규칙 (이슈 #627).
 *
 * <p>고정하는 것은 다섯이다.
 * <ul>
 *   <li><b>초안은 공유되지 않는다</b> — 그리고 그 판정은 발급 때와 조회 때 <b>둘 다</b> 일어난다.
 *       발급 때만 보면 확정 후 초안으로 되돌린 일정이 이미 나간 링크로 계속 열린다
 *   <li><b>만료는 30일 고정</b> — 경계를 {@link Clock} 으로 고정한다. 실행 날짜에 따라 결과가
 *       달라지면 이 규칙은 검증된 것이 아니다
 *   <li><b>폐기는 멱등</b> — 두 번 눌러도 오류가 아니고, 폐기된 링크는 "만료" 가 아니라 "없음" 이다
 *   <li><b>발급은 멱등</b> — 유효한 링크가 있으면 같은 토큰. 회전은 폐기 후 재발급으로만
 *   <li><b>토큰 형식</b> — URL-safe Base64 43자. 짧아지거나 인코딩이 바뀌면 경로에 그대로 못 싣는다
 * </ul>
 */
class PlanShareLinkProcessorTest {

    private static final long PLAN_ID = 900L;
    private static final long MEMBER_ID = 1L;
    private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    private static final Instant ISSUED_AT = LocalDateTime.of(2026, 9, 17, 10, 30).atZone(ZONE).toInstant();

    private StubPlanShareLinkRepositoryPort shareLinkRepositoryPort;
    private StubPlanRepositoryPort planRepositoryPort;
    private MutableClock clock;
    private PlanShareLinkProcessor processor;

    @BeforeEach
    void setUp() {
        shareLinkRepositoryPort = new StubPlanShareLinkRepositoryPort();
        planRepositoryPort = new StubPlanRepositoryPort();
        clock = new MutableClock(ISSUED_AT);
        processor = new PlanShareLinkProcessor(
            shareLinkRepositoryPort, planRepositoryPort, new SnowflakeIdGenerator(0, 0), clock);
    }

    @ParameterizedTest
    @EnumSource(PlanStatus.class)
    @DisplayName("초안은 공유 링크를 발급하지 못하고, 확정·완료만 발급된다")
    void issuesOnlyForShareableStatus(PlanStatus status) {
        Plan plan = plan(status);

        if (status == PlanStatus.DRAFT) {
            assertThatThrownBy(() -> processor.issue(plan))
                .isInstanceOf(PlanException.class)
                .extracting(exception -> ((PlanException) exception).getErrorCode())
                .isEqualTo(PlanErrorCode.SHARE_PLAN_NOT_SHAREABLE);
            return;
        }

        assertThat(processor.issue(plan).token()).isNotBlank();
    }

    @Test
    @DisplayName("토큰은 URL-safe Base64 43자다 — 경로 세그먼트에 그대로 실린다")
    void tokenIsUrlSafeBase64OfFortyThreeChars() {
        String token = processor.issue(plan(PlanStatus.CONFIRMED)).token();

        assertThat(token).hasSize(43).matches("[A-Za-z0-9_-]+");
    }

    @Test
    @DisplayName("유효한 링크가 있으면 같은 토큰을 돌려준다 — 발급은 멱등이다")
    void issueIsIdempotentWhileTheLinkIsValid() {
        Plan plan = plan(PlanStatus.CONFIRMED);

        String first = processor.issue(plan).token();
        String second = processor.issue(plan).token();

        assertThat(second).isEqualTo(first);
        assertThat(shareLinkRepositoryPort.saved).hasSize(1);
    }

    @Test
    @DisplayName("폐기한 뒤 다시 발급하면 다른 토큰이다 — 링크 회전은 이 경로로만 한다")
    void reissueAfterRevokeGivesANewToken() {
        Plan plan = plan(PlanStatus.CONFIRMED);
        String first = processor.issue(plan).token();

        processor.revoke(PLAN_ID);
        String second = processor.issue(plan).token();

        assertThat(second).isNotEqualTo(first);
    }

    @Test
    @DisplayName("만료 30일 정각을 지나면 PLAN_024 410, 29일 23시는 아직 열린다")
    void expiresExactlyThirtyDaysAfterIssue() {
        String token = processor.issue(plan(PlanStatus.CONFIRMED)).token();

        clock.advance(Duration.ofDays(29).plusHours(23));
        assertThat(processor.resolveSharedPlan(token).id()).isEqualTo(PLAN_ID);

        clock.advance(Duration.ofHours(1).plusSeconds(1));
        assertErrorCode(token, PlanErrorCode.SHARE_LINK_EXPIRED);
    }

    @Test
    @DisplayName("폐기한 링크로 열면 PLAN_023 404 다 — 만료(410)와 가르지 않는다")
    void revokedLinkReadsAsNotFound() {
        String token = processor.issue(plan(PlanStatus.CONFIRMED)).token();

        processor.revoke(PLAN_ID);

        assertErrorCode(token, PlanErrorCode.SHARE_LINK_NOT_FOUND);
    }

    @Test
    @DisplayName("폐기를 두 번 불러도 예외가 아니다 — 끄기는 멱등이다")
    void revokeIsIdempotent() {
        processor.issue(plan(PlanStatus.CONFIRMED));

        assertThatCode(() -> {
            processor.revoke(PLAN_ID);
            processor.revoke(PLAN_ID);
        }).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("한 번도 발급하지 않은 일정에 폐기를 불러도 예외가 아니다")
    void revokeWithoutAnyLinkIsSuccess() {
        assertThatCode(() -> processor.revoke(PLAN_ID)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("모르는 토큰은 PLAN_023 404 다")
    void unknownTokenReadsAsNotFound() {
        assertErrorCode("this-token-was-never-issued", PlanErrorCode.SHARE_LINK_NOT_FOUND);
    }

    @Test
    @DisplayName("발급 뒤 일정이 초안으로 되돌아가면 공개 조회가 PLAN_023 404 로 막힌다")
    void revertedToDraftClosesTheAlreadyIssuedLink() {
        String token = processor.issue(plan(PlanStatus.CONFIRMED)).token();

        planRepositoryPort.plan = plan(PlanStatus.DRAFT);

        assertErrorCode(token, PlanErrorCode.SHARE_LINK_NOT_FOUND);
    }

    @Test
    @DisplayName("일정이 소프트 삭제되면 공개 조회가 PLAN_023 404 로 막힌다")
    void softDeletedPlanClosesTheLink() {
        String token = processor.issue(plan(PlanStatus.CONFIRMED)).token();

        planRepositoryPort.plan = null;

        assertErrorCode(token, PlanErrorCode.SHARE_LINK_NOT_FOUND);
    }

    @Test
    @DisplayName("소유자 조회는 유효한 링크가 없으면 PLAN_023 404 다")
    void ownerLookupWithoutValidLinkIsNotFound() {
        Plan plan = plan(PlanStatus.CONFIRMED);

        assertThatThrownBy(() -> processor.getActiveLink(plan))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.SHARE_LINK_NOT_FOUND);

        PlanShareLinkInfo issued = processor.issue(plan);
        assertThat(processor.getActiveLink(plan).token()).isEqualTo(issued.token());
    }

    private void assertErrorCode(String token, PlanErrorCode expected) {
        assertThatThrownBy(() -> processor.resolveSharedPlan(token))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(expected);
    }

    private Plan plan(PlanStatus status) {
        Plan plan = Plan.builder()
            .id(PLAN_ID)
            .memberId(MEMBER_ID)
            .petId(2L)
            .areaCode("39")
            .title("몽실이와 제주 2박 3일")
            .startDate(LocalDate.of(2026, 9, 12))
            .endDate(LocalDate.of(2026, 9, 14))
            .status(status)
            .build();
        planRepositoryPort.plan = plan;
        return plan;
    }

    /** 만료 경계를 실행 날짜와 무관하게 고정한다 — 서비스는 주입받은 Clock 만 읽는다. */
    private static final class MutableClock extends Clock {

        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        private void advance(Duration amount) {
            instant = instant.plus(amount);
        }

        @Override
        public ZoneId getZone() {
            return ZONE;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }

    /** 유니크 토큰·미폐기 최신 행 선택·벌크 폐기를 메모리에서 흉내 낸다 (실제 SQL 은 H2 슬라이스가 본다). */
    private static final class StubPlanShareLinkRepositoryPort implements PlanShareLinkRepositoryPort {

        private final List<PlanShareLink> saved = new ArrayList<>();

        @Override
        public PlanShareLink save(PlanShareLink shareLink) {
            saved.add(shareLink);
            return shareLink;
        }

        @Override
        public Optional<PlanShareLink> findByToken(String token) {
            return saved.stream().filter(link -> link.token().equals(token)).findFirst();
        }

        @Override
        public Optional<PlanShareLink> findValidByPlanId(long planId, LocalDateTime now) {
            return saved.stream()
                .filter(link -> link.planId() == planId)
                .filter(link -> !link.isRevoked())
                .filter(link -> !link.isExpiredAt(now))
                .max(Comparator.comparingLong(PlanShareLink::id));
        }

        @Override
        public int revokeActiveByPlanId(long planId, LocalDateTime revokedAt) {
            int closed = (int) saved.stream().filter(link -> link.planId() == planId && !link.isRevoked()).count();
            saved.replaceAll(link -> link.planId() == planId && !link.isRevoked() ? link.revoke(revokedAt) : link);
            return closed;
        }
    }

    private static final class StubPlanRepositoryPort implements PlanRepositoryPort {

        private Plan plan;

        @Override
        public Plan save(Plan candidate) {
            this.plan = candidate;
            return candidate;
        }

        @Override
        public Optional<Plan> findActiveById(long planId) {
            return Optional.ofNullable(plan).filter(found -> found.id() == planId);
        }

        @Override
        public Slice<Plan> findMyPlans(long memberId, Long petId, long lastPlanId, int size) {
            throw new UnsupportedOperationException("공유 링크 경로는 목록 조회를 쓰지 않는다");
        }

        @Override
        public List<Plan> findCompanionEditablePlansWithPet(long memberId, long petId) {
            throw new UnsupportedOperationException("공유 링크 경로는 동행견 정리를 쓰지 않는다");
        }

        @Override
        public List<Plan> findCompanionEditablePlans(long memberId) {
            throw new UnsupportedOperationException("공유 링크 경로는 동행견 정리를 쓰지 않는다");
        }

        @Override
        public List<Long> findMemberIdsWithCompanionEditablePlans(long lastMemberId, int size) {
            throw new UnsupportedOperationException("공유 링크 경로는 동행견 정리를 쓰지 않는다");
        }

        @Override
        public Optional<Plan> findActiveByIdForUpdate(long planId) {
            throw new UnsupportedOperationException("공유 링크 경로는 동행견 정리를 쓰지 않는다");
        }

        @Override
        public int promoteRepresentative(long planId, long petId, long expectedPetId) {
            throw new UnsupportedOperationException("공유 링크 경로는 동행견 정리를 쓰지 않는다");
        }
    }
}
