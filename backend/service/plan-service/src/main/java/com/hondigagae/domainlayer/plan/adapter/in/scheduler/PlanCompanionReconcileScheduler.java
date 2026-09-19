package com.hondigagae.domainlayer.plan.adapter.in.scheduler;

import com.hondigagae.domainlayer.plan.application.model.PlanCompanionReconcileCounts;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanCompanionReconcileProcessor;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 삭제된 반려견을 일정 동행 목록에서 걷어내는 대사(reconcile) 배치 (#720).
 *
 * <p>반려견은 auth-service 에서 소프트 삭제되고 일정은 plan-service DB 에 있다. 스키마가 갈라져
 * FK 가 없으므로 삭제된 아이의 {@code plan_pet} 행이 그대로 남는다. auth 가 plan 을 부르는 푸시
 * 대신 <b>plan 이 주기적으로 물어보는</b> 한 방향을 택했다 — auth 에 첫 아웃바운드 의존과
 * auth ↔ plan 순환을 만들지 않기 위해서다. 정리 규칙 자체는
 * {@code PlanPetDetachProcessor} 에 있다.
 *
 * <p><b>기존 잔여 행도 이 배치가 정리한다.</b> 첫 회차가 이미 남아 있던 행을 함께 걷으므로
 * 배포 전후에 운영 DB 로 DML 을 돌릴 필요가 없다.
 *
 * <p><b>회원 단위 실패는 건너뛰고, 연속 {@value #MAX_CONSECUTIVE_MEMBER_FAILURES} 회면 회차를
 * 중단한다.</b> 응답을 <b>못 받은 것</b>을 "전부 삭제됨" 으로 읽으면 멀쩡한 동행견을 떼어내므로
 * 원천이 흔들릴 때는 멈춰야 하지만, 회원 하나의 실패로 멈추면 커서가 매 회차 0부터 시작하는 탓에
 * 그 뒤 회원이 영영 정리되지 않는다. 남은 몫은 다음 회차가 이어받는다 — 매일 도는 작업이라
 * 하루 늦는 것은 손해가 아니지만 잘못 지운 동행견은 되돌릴 수 없다.
 *
 * <p>반대로 <b>빈 목록 200 은 정상 응답</b>이라 그대로 믿는다. auth 의 조회가 요청 petIds 와의
 * 교집합을 내므로 "요청한 아이가 전부 삭제됨" 이 곧 빈 목록이고, 그게 바로 정리 대상이다.
 * 여기서 회원을 건너뛰면 #720 증상이 그대로 남는다.
 *
 * <p>{@code WithdrawnMemberPurgeScheduler} 와 같은 뼈대다 — 커서 페이지 순회, 회차 상한,
 * 멱등, 회차 끝의 건수 로그. 다른 점은 이 배치가 행을 지우지 않는다는 것이다. 커서가 항상
 * 앞으로 가므로 루프는 스스로 끝나고, 회차 상한은 그럼에도 남겨 둔 안전장치다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanCompanionReconcileScheduler {

    /**
     * 한 페이지에서 훑는 회원 수.
     *
     * <p>회원마다 auth-service 왕복이 한 번이라 페이지를 키워도 원격 호출 수는 그대로다.
     * 페이지는 DB 왕복 단위일 뿐이므로, 한 번에 들고 있는 아이디 목록이 부담되지 않는 크기면 된다.
     */
    private static final int MEMBER_PAGE_SIZE = 200;

    /**
     * 한 회차에서 도는 페이지 수의 상한 — 무한 루프 방지장치다.
     *
     * <p>커서가 매 페이지 전진하므로 정상 동작에서는 대상이 마르면 루프가 끝난다. 그럼에도
     * 상한을 두는 이유는 조회가 예상 밖으로 같은 페이지를 돌려주는 상황 때문이다. 상한에 걸리면
     * 남은 회원은 다음 회차(하루 뒤)로 넘긴다.
     *
     * <p>200 × 500 = 한 회차 최대 10만 명. 이 서비스 규모에서 전량을 소화하고도 남는다.
     */
    private static final int MAX_PAGES_PER_RUN = 500;

    /**
     * 회차를 중단시키는 <b>연속</b> 실패 수.
     *
     * <p>회원 하나의 실패로 회차를 멈추면 안 된다 — 커서가 매 회차 0부터 다시 시작하므로, 특정
     * 회원에서 결정적으로 실패하면 <b>매일 같은 자리에서 멈춰 그 뒤 회원은 영원히 정리되지 않는다</b>.
     * 게다가 {@code InternalResponseSupport} 는 4xx 를 포함한 모든 {@code FeignException} 을 503 으로
     * 바꾸므로, 회원 하나의 데이터 문제가 "원천 장애" 처럼 보이기 쉽다.
     *
     * <p>반대로 auth-service 전면 장애는 <b>첫 다섯 회원이 연속으로 실패</b>하므로 사실상 즉시
     * 중단된다 — 조기 중단이 필요한 상황은 그대로 잡고, 회원 하나의 문제로 전체가 막히지는 않는다.
     */
    private static final int MAX_CONSECUTIVE_MEMBER_FAILURES = 5;

    private final PlanCompanionReconcileProcessor planCompanionReconcileProcessor;

    /**
     * 트랜잭션은 <b>여기가 아니라</b> 일정 단위(프로세서)에 걸려 있다. 회차 전체를 묶으면 일정
     * 하나가 실패할 때 이미 정리한 일정까지 롤백되고, 사용자 경로가 읽는 테이블의 잠금을 실행
     * 내내 붙잡는다.
     */
    @Scheduled(cron = "${plan-companion-reconcile.cron:0 10 4 * * *}")
    public void reconcileCompanionPets() {
        long startedAt = System.nanoTime();
        long lastMemberId = 0L;
        int pages = 0;
        int members = 0;
        int failures = 0;
        int consecutiveFailures = 0;
        Long lastFailedMemberId = null;
        boolean pageCapReached = false;
        boolean aborted = false;
        PlanCompanionReconcileCounts counts = PlanCompanionReconcileCounts.NONE;

        // 회차 요약은 무슨 일이 있어도 남긴다. catch 하지 않은 예외(페이지 조회의 DataAccessException 등)로
        // 빠져나갈 때 로그가 통째로 사라지면, 하필 이상이 생긴 날의 수치를 못 보게 된다.
        try {
            while (true) {
                if (pages >= MAX_PAGES_PER_RUN) {
                    // 여기 도달했다는 것은 마지막 페이지가 꽉 차서 "더 볼 것이 있다" 는 뜻이다.
                    // 정확히 상한 번째 페이지가 덜 찬 경우는 아래에서 이미 루프를 빠져나간다.
                    pageCapReached = true;
                    break;
                }
                List<Long> memberIds = planCompanionReconcileProcessor.findMemberIdsToReconcile(lastMemberId, MEMBER_PAGE_SIZE);
                pages++;
                if (memberIds.isEmpty()) {
                    break;
                }
                for (Long memberId : memberIds) {
                    try {
                        counts = counts.plus(planCompanionReconcileProcessor.reconcileMember(memberId));
                        members++;
                        consecutiveFailures = 0;
                    } catch (RuntimeException exception) {
                        failures++;
                        consecutiveFailures++;
                        lastFailedMemberId = memberId;
                        log.warn("[PlanCompanionReconcileScheduler] 회원 정리에 실패해 건너뜁니다. "
                                + "memberId={} consecutiveFailures={}", memberId, consecutiveFailures, exception);
                        if (consecutiveFailures >= MAX_CONSECUTIVE_MEMBER_FAILURES) {
                            aborted = true;
                            break;
                        }
                    }
                }
                if (aborted) {
                    break;
                }
                lastMemberId = memberIds.get(memberIds.size() - 1);
                // 페이지가 덜 찼다는 것은 대상이 마른 것이다 — 한 번 더 조회할 이유가 없다.
                if (memberIds.size() < MEMBER_PAGE_SIZE) {
                    break;
                }
            }
        } finally {
            if (pageCapReached) {
                log.warn("[PlanCompanionReconcileScheduler] 한 회차 페이지 상한에 도달했습니다. 남은 회원은 다음 회차에 처리합니다. "
                    + "maxPages={} pageSize={}", MAX_PAGES_PER_RUN, MEMBER_PAGE_SIZE);
            }
            if (aborted) {
                log.warn("[PlanCompanionReconcileScheduler] 연속 실패가 상한에 닿아 이번 회차를 중단합니다. "
                        + "남은 회원은 다음 회차가 이어받습니다. maxConsecutiveFailures={} lastFailedMemberId={}",
                    MAX_CONSECUTIVE_MEMBER_FAILURES, lastFailedMemberId);
            }
            // 정리할 것이 없어도 한 줄은 남긴다. 회원당 원격 왕복 한 번이라는 구조가 유지되는지,
            // 회차가 얼마나 걸리는지는 "아무 일도 없었던 날" 의 수치가 있어야 읽을 수 있다.
            log.info("[PlanCompanionReconcileScheduler] 동행 반려견 대사 완료. elapsedMs={} pages={} members={} failures={} "
                    + "remoteCalls={} aborted={} detached={} representativeChanged={} placeholderKept={} legacyPlansSkipped={}",
                (System.nanoTime() - startedAt) / 1_000_000L, pages, members, failures, counts.remoteCalls(), aborted,
                counts.detached(), counts.representativeChanged(), counts.placeholderKept(), counts.legacyPlansSkipped());
        }
    }
}
