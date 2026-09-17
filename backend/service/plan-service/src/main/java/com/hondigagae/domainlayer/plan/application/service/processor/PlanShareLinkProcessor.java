package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.info.PlanShareLinkInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanShareLinkRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanShareLink;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 일정 읽기 전용 공유 링크의 발급·조회·폐기·해석 (이슈 #627).
 *
 * <p><b>시각은 주입받은 {@link Clock} 하나로만 읽는다.</b> {@code LocalDateTime.now()} 를 직접
 * 부르면 JVM 기본 시간대를 따르게 되어, 만료 판정이 발급 때와 조회 때 서로 다른 기준을 쓸 수
 * 있다 — "30일" 이 배포 환경변수({@code TIME_ZONE}) 하나로 29일이나 31일이 된다.
 * {@code BaseEntity.createdAt} 도 JVM 시간대라 그 값과 산술하지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanShareLinkProcessor {

    /** 링크 수명. 요청 바디로 받지 않는 고정값이다 — 무기한 링크를 만들 수단을 아예 두지 않는다. */
    private static final Period LINK_LIFETIME = Period.ofDays(30);

    /**
     * 토큰 바이트 수. 32바이트(256비트)는 URL-safe Base64 로 패딩 없이 43자가 되고, 추측으로
     * 맞히는 것이 사실상 불가능하다 — 이 토큰 하나가 곧 열람 권한이라 짧게 줄이지 않는다.
     */
    private static final int TOKEN_BYTES = 32;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Base64.Encoder TOKEN_ENCODER = Base64.getUrlEncoder().withoutPadding();

    private final PlanShareLinkRepositoryPort planShareLinkRepositoryPort;
    private final PlanRepositoryPort planRepositoryPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;
    private final Clock clock;

    /**
     * 공유 링크 발급. <b>멱등이다</b> — 유효한(미폐기·미만료) 링크가 이미 있으면 새로 만들지 않고
     * 그것을 돌려준다. 버튼 연타나 재시도가 링크를 여러 개 흩뿌리면 어느 것이 도는지 알 수 없고,
     * 폐기가 그중 하나만 닫는 착각을 만든다. 회전이 필요하면 DELETE 후 POST 다.
     */
    @Transactional
    public PlanShareLinkInfo issue(Plan plan) {
        requireShareable(plan);

        LocalDateTime now = LocalDateTime.now(clock);
        PlanShareLink existing = planShareLinkRepositoryPort.findValidByPlanId(plan.id(), now).orElse(null);
        if (existing != null) {
            return toInfo(existing);
        }

        PlanShareLink issued = planShareLinkRepositoryPort.save(PlanShareLink.builder()
            .id(snowflakeIdGenerator.generateId())
            .planId(plan.id())
            .token(generateToken())
            .expiresAt(now.plus(LINK_LIFETIME))
            .build());

        log.info("Plan share link issued. planId={} expiresAt={}", issued.planId(), issued.expiresAt());
        return toInfo(issued);
    }

    /**
     * 소유자가 보는 현재 링크. 유효한 링크가 없으면(한 번도 안 만들었거나 폐기·만료됐으면)
     * {@code PLAN_023} 404 다 — 소유자 경로에는 토큰이 없어 "만료" 와 "없음" 을 가를 입력 자체가
     * 없고, 어느 쪽이든 할 일은 "새로 발급" 으로 같다.
     */
    @Transactional(readOnly = true)
    public PlanShareLinkInfo getActiveLink(Plan plan) {
        return planShareLinkRepositoryPort.findValidByPlanId(plan.id(), LocalDateTime.now(clock))
            .map(PlanShareLinkProcessor::toInfo)
            .orElseThrow(() -> new PlanException(PlanErrorCode.SHARE_LINK_NOT_FOUND));
    }

    /**
     * 공유 링크 폐기. <b>멱등이다</b> — 닫을 링크가 없어도 성공으로 본다. 끄기 버튼이 두 번 눌렸다고
     * 오류를 보여 줄 이유가 없고, 결과 상태("공유 중이 아니다")는 어느 쪽이든 같다.
     *
     * <p>닫은 행 수를 함께 남긴다. 동시 발급으로 유효 링크가 둘 생기는 경쟁은 "받아들이는 잔여
     * 결함" 이지만, <b>{@code closed > 1} 이 그 경쟁이 실제로 일어났다는 유일한 관측 수단</b>이다.
     */
    @Transactional
    public void revoke(long planId) {
        int closed = planShareLinkRepositoryPort.revokeActiveByPlanId(planId, LocalDateTime.now(clock));
        log.info("Plan share link revoked. planId={} closed={}", planId, closed);
    }

    /**
     * 토큰으로 공개할 일정을 찾는다. 여기가 소유자 경로({@code getOwnedPlan})와 <b>갈라지는 단
     * 하나의 지점</b>이다 — 항목 조회와 장소 요약은 그 뒤 기존 흐름에 합류한다.
     *
     * <p>없음·폐기·일정 삭제·비공유 상태는 전부 {@code PLAN_023} 404 로 <b>같게</b> 답한다.
     * 구분해서 알려 주면 토큰을 찍어 보는 쪽에 "이 토큰은 존재했다"·"이 일정은 있다" 를 흘린다.
     * 만료만 {@code PLAN_024} 410 으로 가른다 — 받은 사람이 "새 링크를 달라" 고 말할 수 있어야 한다.
     */
    @Transactional(readOnly = true)
    public Plan resolveSharedPlan(String token) {
        PlanShareLink link = planShareLinkRepositoryPort.findByToken(token)
            .orElseThrow(() -> new PlanException(PlanErrorCode.SHARE_LINK_NOT_FOUND));

        // 폐기를 만료보다 먼저 본다. 폐기한 뒤 만료 시각까지 지난 링크는 "만료" 가 아니라 "없는 링크" 다.
        if (link.isRevoked()) {
            throw new PlanException(PlanErrorCode.SHARE_LINK_NOT_FOUND);
        }
        if (link.isExpiredAt(LocalDateTime.now(clock))) {
            throw new PlanException(PlanErrorCode.SHARE_LINK_EXPIRED);
        }

        Plan plan = planRepositoryPort.findActiveById(link.planId())
            .orElseThrow(() -> new PlanException(PlanErrorCode.SHARE_LINK_NOT_FOUND));
        if (!plan.status().isShareable()) {
            throw new PlanException(PlanErrorCode.SHARE_LINK_NOT_FOUND);
        }
        return plan;
    }

    /** 발급 시점 판정. 조회 시점 판정은 {@link #resolveSharedPlan} 이 따로 한다 (되돌린 일정을 막기 위해). */
    private static void requireShareable(Plan plan) {
        if (!plan.status().isShareable()) {
            throw new PlanException(PlanErrorCode.SHARE_PLAN_NOT_SHAREABLE);
        }
    }

    /** URL-safe Base64 라 경로 세그먼트에 그대로 실린다 — 인코딩 왕복에서 값이 바뀌지 않는다. */
    private static String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return TOKEN_ENCODER.encodeToString(bytes);
    }

    private static PlanShareLinkInfo toInfo(PlanShareLink link) {
        return PlanShareLinkInfo.builder()
            .planId(link.planId())
            .token(link.token())
            .expiresAt(link.expiresAt())
            .build();
    }
}
