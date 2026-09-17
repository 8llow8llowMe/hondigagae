package com.hondigagae.domainlayer.member.application.service.processor;

import com.hondigagae.domainlayer.member.application.port.out.MemberConsentRepositoryPort;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.pet.application.port.out.PetRepositoryPort;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 보존 기간이 지난 탈퇴 회원을 <b>한 배치씩</b> 물리 삭제한다.
 *
 * <p>정책(무엇을 왜 지우는가)은 호출부인 {@code WithdrawnMemberPurgeScheduler} 에 있다. 여기서
 * 지키는 것은 <b>한 배치가 통째로 커밋되거나 통째로 롤백된다</b>는 것 하나다.
 *
 * <p><b>왜 배치 단위로 트랜잭션을 끊는가</b> — 전체를 한 트랜잭션으로 묶으면 대상이 많을 때
 * {@code member} · {@code pet} · {@code member_consent} 의 잠금을 실행 내내 붙잡는다. 이 테이블은
 * 로그인 경로가 읽는 테이블이라 새벽 실행이라도 영향이 간다. 배치마다 끊으면 중간에 실패해도
 * 이미 지운 배치는 남고 다음 회차가 이어받는다 — 파기는 재실행이 안전한 작업이라 부분 진행이
 * 문제가 되지 않는다.
 */
@Service
@RequiredArgsConstructor
public class WithdrawnMemberPurgeProcessor {

    private final MemberRepositoryPort memberRepositoryPort;
    private final PetRepositoryPort petRepositoryPort;
    private final MemberConsentRepositoryPort memberConsentRepositoryPort;

    /**
     * 기준 시각 이전에 탈퇴한 회원을 최대 {@code batchSize} 명까지 지운다.
     *
     * @return 실제로 지운 회원 수. 호출부가 이 값으로 다음 배치가 필요한지 판단한다
     */
    @Transactional
    public int purgeBatch(LocalDateTime threshold, int batchSize) {
        List<Long> memberIds = memberRepositoryPort.findWithdrawnMemberIdsBefore(threshold, batchSize);
        if (memberIds.isEmpty()) {
            return 0;
        }

        // 자식 → 부모 순. 반대로 지우면 부모가 사라진 뒤 자식 정리가 실패했을 때 고아 행이 남는다.
        petRepositoryPort.deleteAllByMemberIdIn(memberIds);
        memberConsentRepositoryPort.deleteAllByMemberIdIn(memberIds);
        memberRepositoryPort.deleteAllByIdIn(memberIds);

        return memberIds.size();
    }
}
