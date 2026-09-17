package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanShareLinkEntity;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PlanShareLinkRepository extends JpaRepository<PlanShareLinkEntity, Long> {

    /** 공개 조회의 유일한 진입. 폐기·만료 판정은 도메인이 하므로 여기서는 거르지 않는다. */
    Optional<PlanShareLinkEntity> findByToken(String token);

    /**
     * 멱등 발급이 재사용할 <b>유효한</b> 링크. 폐기되지 않았고 아직 만료 전인 것 중 최신 하나다.
     *
     * <p>{@code OrderByIdDesc} 로 최신을 고른다 — 폐기는 행을 지우지 않으므로 한 일정에 여러 행이
     * 쌓이고, 동시 요청 둘이 각각 INSERT 한 드문 경우에도 살아 있는 행이 둘일 수 있다.
     */
    Optional<PlanShareLinkEntity> findFirstByPlanIdAndRevokedAtIsNullAndExpiresAtAfterOrderByIdDesc(
        Long planId, LocalDateTime now);

    /**
     * 해당 일정의 <b>미폐기 링크를 전부</b> 닫는다. 0건이어도 성공이다 (DELETE 는 멱등이다).
     *
     * <p>한 행만 닫으면 위 동시 INSERT 로 남은 형제 행이 살아남아, 사용자가 "링크를 껐다" 고
     * 믿는 동안 옛 링크가 계속 열린다. {@code revokedAt is null} 조건으로 <b>이미 폐기된 행의
     * 폐기 시각은 건드리지 않는다</b> — 그 시각이 유출 추적의 근거다.
     *
     * <p>{@code clearAutomatically = true} 인 이유: 벌크 JPQL 은 영속성 컨텍스트를 건드리지 않아
     * 같은 트랜잭션에서 방금 닫은 행이 1차 캐시에 유효한 채로 남는다.
     *
     * <p><b>{@code updatedAt} 을 손으로 함께 찍는다.</b> 벌크 JPQL 은 JPA 감사({@code @LastModifiedDate})를
     * 우회하므로 그냥 두면 행이 바뀌었는데 수정 시각은 발급 때 그대로다. 이 저장소는 감사를 우회하는
     * 쓰기에서 {@code updated_at} 을 손으로 채우는 것이 관례다 — batch-service 의
     * {@code JdbcEmergencyFacilityDelistAdapter} 가 {@code delisted_at} 과 함께 {@code updated_at = NOW()} 를
     * 찍는다. 이것이 저장소 최초의 벌크 UPDATE 라 다음 사람의 선례가 된다.
     *
     * @return 실제로 닫힌 행 수. 1을 넘으면 동시 발급 경쟁이 실제로 일어났다는 뜻이라 호출부가 로그로 남긴다
     */
    @Modifying(clearAutomatically = true)
    @Query("update PlanShareLinkEntity link set link.revokedAt = :revokedAt, link.updatedAt = :revokedAt "
        + "where link.planId = :planId and link.revokedAt is null")
    int revokeActiveByPlanId(Long planId, LocalDateTime revokedAt);
}
