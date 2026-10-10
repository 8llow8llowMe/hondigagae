package com.hondigagae.domainlayer.plan.domain.model;

import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 일정 읽기 전용 공유 링크 (이슈 #627).
 *
 * <p>링크는 <b>지우지 않고 닫는다</b> — 폐기는 행 삭제가 아니라 {@code revokedAt} 타임스탬프다.
 * 지워 버리면 "이 링크가 폐기된 것" 과 "애초에 없던 토큰" 이 구분되지 않아, 나중에 유출 경로를
 * 추적할 근거가 사라진다. 바깥으로는 둘 다 404 로 같게 보인다.
 *
 * @param expiresAt 만료 시각. 발급 시각 + 30일이며 서비스 {@code Clock} 으로 계산한다
 * @param revokedAt 폐기 시각. null 이면 아직 유효하다
 */
@Builder(toBuilder = true)
public record PlanShareLink(
    long id,
    long planId,
    String token,
    LocalDateTime expiresAt,
    LocalDateTime revokedAt
) {

    public boolean isRevoked() {
        return revokedAt != null;
    }

    /**
     * 만료 판정. <b>만료 시각 정각은 이미 만료</b>다 — 경계를 유효 쪽에 두면 "30일" 이
     * 상황에 따라 30일 + 1틱이 된다.
     */
    public boolean isExpiredAt(LocalDateTime now) {
        return !now.isBefore(expiresAt);
    }

    /**
     * 폐기된 사본. <b>운영 폐기는 이 메서드가 하지 않는다</b> —
     * {@code PlanShareLinkRepository.revokeActiveByPlanId} 의 벌크 UPDATE 가 한 일정의 미폐기 행을
     * 한 번에 닫는다. 이것은 도메인 표현과 테스트 fake 를 위한 것이다.
     *
     * <p><b>폐기 규칙을 바꿀 때 여기만 고치면 안 된다.</b> 실제로 도는 것은 그 JPQL 이라
     * 여기만 바꾸면 테스트는 통과하고 운영 동작은 그대로다.
     */
    public PlanShareLink revoke(LocalDateTime now) {
        return toBuilder().revokedAt(now).build();
    }
}
