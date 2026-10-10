package com.hondigagae.domainlayer.member.adapter.in.migration;

import com.hondigagae.domainlayer.member.application.port.out.WithdrawnEmailMigrationPort;
import com.hondigagae.domainlayer.member.application.port.out.query.WithdrawnMemberQueryResult;
import com.hondigagae.domainlayer.member.application.service.support.WithdrawnEmailHasher;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * #609 이전에 탈퇴한 회원의 이메일 원문을 다이제스트로 바꾸는 <b>일회성</b> 러너.
 *
 * <p><b>SQL 마이그레이션으로 못 한다</b> — MySQL 에 HMAC 내장 함수가 없어 애플리케이션이
 * 계산해야 한다. 그래서 기동 시점에 한 번 돌리고, 끝나면 대상이 0건이라 조용히 지나간다.
 *
 * <p><b>멱등하다.</b> 대상 판별이 "email 에 {@code @} 가 있는 탈퇴 행"이고 치환 결과인
 * 다이제스트(hex)에는 {@code @} 가 없어서, 이미 처리한 행은 다음 실행에서 대상에 잡히지 않는다.
 * 여러 인스턴스가 동시에 떠도 같은 입력은 같은 다이제스트라 결과가 달라지지 않는다.
 *
 * <p><b>{@code withdrawnAt} 은 근사치다.</b> 옛 행에는 탈퇴 시각이 없으므로 {@code updatedAt} 을
 * 쓴다 — 탈퇴 이후 이 행을 갱신하는 경로가 없어 가장 그럴듯한 값이다. 정확한 값이 아니라는
 * 점은 보존 기간(30일) 판정이 며칠 어긋날 수 있다는 뜻이고, 그 정도 오차는 감수한다.
 *
 * <p><b>실패하면 기동이 멈춘다.</b> 원문 이메일이 남은 채로 서비스가 도는 것보다 낫고,
 * 멱등이라 원인을 고쳐 재기동하면 남은 행부터 이어서 처리된다.
 *
 * <p><b>일회성 코드다 — dev/prod 에 1회 적용된 것이 확인되면 다음 정리 PR 에서 제거한다.</b>
 * 함께 지울 것: {@code WithdrawnEmailMigrationPort}, {@code WithdrawnEmailMigrationAdapter},
 * {@code WithdrawnMemberQueryResult}, {@code MemberRepository} 의 마이그레이션 쿼리 2개.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WithdrawnEmailMigrationRunner implements ApplicationRunner {

    private final WithdrawnEmailMigrationPort withdrawnEmailMigrationPort;
    private final WithdrawnEmailHasher withdrawnEmailHasher;

    @Override
    public void run(ApplicationArguments args) {
        List<WithdrawnMemberQueryResult> targets = withdrawnEmailMigrationPort.findWithdrawnMembersWithRawEmail();
        if (targets.isEmpty()) {
            return;
        }

        // 행마다 다이제스트가 달라 하나의 update 문으로 묶을 수 없다. 대상은 탈퇴 회원 수라
        // 유한하고 이 코드는 배포당 한 번만 유효하므로 단건 반복을 그대로 둔다 (§9-7 예외).
        for (WithdrawnMemberQueryResult target : targets) {
            LocalDateTime withdrawnAt = target.withdrawnAt() != null ? target.withdrawnAt() : target.updatedAt();
            withdrawnEmailMigrationPort.replaceWithdrawnEmail(
                target.id(), withdrawnEmailHasher.hash(target.email()), withdrawnAt);
        }

        // 이메일 원문도 다이제스트도 로그에 남기지 않는다 — 건수만으로 적용 여부를 판단한다.
        log.info("[WithdrawnEmailMigrationRunner] 탈퇴 회원 이메일 다이제스트 치환 완료. converted={} "
            + "(withdrawnAt 은 updatedAt 기반 근사치)", targets.size());
    }
}
