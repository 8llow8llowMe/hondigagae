package com.hondigagae.domainlayer.member.adapter.in.scheduler;

import com.hondigagae.domainlayer.member.application.service.processor.WithdrawnMemberPurgeProcessor;
import java.time.Duration;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 보존 기간이 지난 탈퇴 회원 행의 물리 삭제.
 *
 * <p>탈퇴 시점에 이미 개인정보는 마스킹·제거되고 이메일은 다이제스트로 치환된다. 그래도 행 자체가
 * 남는 이유는 <b>동일 이메일 재가입 차단</b> 하나뿐이다. 그 목적은 착오 탈퇴 직후의 즉시 재가입을
 * 막는 것이므로, 목적에 필요한 기간을 넘겨 보관할 근거가 없다 (개인정보 보호법 제21조).
 *
 * <p><b>왜 30일인가</b> — 실수로 탈퇴한 사람이 알아채고 문의하기까지의 현실적인 상한이면서,
 * 탈퇴 직후 재가입으로 기존 이력을 세탁하는 것을 막기에 충분한 기간이다. 더 길게 잡으면 목적
 * 없는 보관이 되고, 더 짧으면 차단이 사실상 없는 것과 같아진다.
 *
 * <p><b>회원 행만 지우면 안 된다.</b> 같은 스키마의 {@code pet}, {@code member_consent} 가 raw FK
 * 로 회원을 참조하므로 자식 → 부모 순으로 함께 지운다. 남기면 어느 회원 것인지 알 수 없는 고아
 * 행이 되어 그 자체가 정리 불가능한 잔여 데이터가 된다.
 *
 * <p><b>반려견 프로필 이미지(MinIO)는 여기서 지우지 않는다.</b> 행이 사라지면 객체가 고아가
 * 되는데, 그 회수는 {@code PetProfileImageCleanupScheduler} 가 이미 하고 있다 — DB 어디에서도
 * 참조되지 않는 오래된 객체를 지우는 것이 그 스케줄러의 정의다. 여기에 스토리지 삭제를 또
 * 넣으면 같은 일을 두 곳에서 하게 된다. (회원 프로필 이미지는 탈퇴 시점에 이미 제거된다)
 *
 * <p>{@code withdrawnAt} 이 null 인 탈퇴 행은 <b>기간 미경과로 취급해</b> 대상에서 빠진다.
 * 마이그레이션 전의 옛 행이 여기 해당하고, {@code WithdrawnEmailMigrationRunner} 가 기동 시
 * 값을 채우므로 그 뒤부터 정상적으로 잡힌다.
 *
 * <p><b>왜 나눠서 지우는가</b> — 평시에는 하루치라 한 줌이지만, 마이그레이션이 옛 탈퇴 행의
 * {@code withdrawnAt} 을 한꺼번에 채우고 나면 그 다음 실행에 누적분 전체가 한 번에 대상이 된다.
 * 대상 아이디를 통째로 {@code in (...)} 에 싣는 구조라 그때 파라미터가 수천 개짜리 delete 가
 * 나간다. 그래서 한 번에 {@link #BATCH_SIZE} 건씩 끊어 지운다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WithdrawnMemberPurgeScheduler {

    private static final Duration RETENTION = Duration.ofDays(30);

    /**
     * 한 배치에서 지우는 회원 수.
     *
     * <p><b>1000 인 근거</b> — {@code in (...)} 파라미터 1000개는 MySQL 이 부담 없이 소화하는 범위이고
     * (Oracle 의 1000개 상한이 사실상의 업계 기준선이다), 한 배치가 잠금을 붙잡는 시간도 짧게 유지된다.
     * 더 키우면 배치당 잠금 구간이 길어지고, 더 줄이면 왕복만 늘 뿐 얻는 것이 없다.
     */
    private static final int BATCH_SIZE = 1000;

    /**
     * 한 회차에서 도는 배치 수의 상한 — 무한 루프 방지장치다.
     *
     * <p>정상 동작에서는 배치마다 실제로 행이 사라지므로 다음 조회가 줄어들고, 대상이 마르면
     * 루프가 스스로 끝난다. 그럼에도 상한을 두는 이유는 <b>삭제가 반영되지 않는 상황</b>(예상 못 한
     * 제약 위반으로 배치가 매번 롤백되는 경우) 때문이다. 그때 종료 조건만 믿으면 같은 배치를
     * 영원히 반복한다. 상한에 걸리면 남은 것은 다음 회차(하루 뒤)로 넘긴다 — 파기는 하루 늦어도
     * 되는 작업이고, 새벽 배치가 끝없이 도는 것보다 낫다.
     *
     * <p>1000 × 50 = 한 회차 최대 5만 명. 이 서비스 규모에서 누적분을 한 번에 소화하고도 남는다.
     */
    private static final int MAX_BATCHES_PER_RUN = 50;

    private final WithdrawnMemberPurgeProcessor withdrawnMemberPurgeProcessor;

    /**
     * 트랜잭션은 <b>여기가 아니라</b> 배치 단위(프로세서)에 걸려 있다. 회차 전체를 한 트랜잭션으로
     * 묶으면 대상이 많을 때 로그인 경로가 읽는 테이블의 잠금을 실행 내내 붙잡는다.
     */
    @Scheduled(cron = "${member-purge.withdrawn-cron:0 0 5 * * *}")
    public void purgeExpiredWithdrawnMembers() {
        // 기준 시각은 회차 시작 시점으로 고정한다. 배치마다 다시 계산하면 실행 도중 경계가 밀려
        // "어느 기준으로 지웠는가"가 흐려진다.
        LocalDateTime threshold = LocalDateTime.now().minus(RETENTION);

        int deleted = 0;
        int batches = 0;
        while (batches < MAX_BATCHES_PER_RUN) {
            int purged = withdrawnMemberPurgeProcessor.purgeBatch(threshold, BATCH_SIZE);
            if (purged == 0) {
                break;
            }
            deleted += purged;
            batches++;
            // 배치가 덜 찼다는 것은 대상이 마른 것이다 — 한 번 더 조회할 이유가 없다.
            if (purged < BATCH_SIZE) {
                break;
            }
        }

        if (deleted == 0) {
            return;
        }

        if (batches == MAX_BATCHES_PER_RUN) {
            log.warn("[WithdrawnMemberPurgeScheduler] 한 회차 배치 상한에 도달했습니다. 남은 대상은 다음 회차에 처리합니다. "
                + "maxBatches={} batchSize={} deleted={}", MAX_BATCHES_PER_RUN, BATCH_SIZE, deleted);
        }
        log.info("[WithdrawnMemberPurgeScheduler] 보존 기간이 지난 탈퇴 회원 삭제 완료. retentionDays={} batches={} deleted={}",
            RETENTION.toDays(), batches, deleted);
    }
}
