package com.hondigagae.domainlayer.member.application.port.out;

import com.hondigagae.domainlayer.member.application.port.out.query.WithdrawnMemberQueryResult;
import java.time.LocalDateTime;
import java.util.List;

/**
 * #609 일회성 마이그레이션 전용 포트. 탈퇴 회원의 이메일 원문을 다이제스트로 바꾼다.
 *
 * <p>일반 조회/저장과 섞지 않고 포트를 따로 둔 이유는 <b>통째로 지우기 위해서</b>다.
 * dev/prod 에 1회 적용된 것이 확인되면 이 포트와 구현체, 러너, 쿼리 결과 타입을 한 번에
 * 제거한다.
 */
public interface WithdrawnEmailMigrationPort {

    /** 탈퇴 상태인데 email 에 원문이 남아 있는(= {@code @} 가 들어 있는) 행 전부. */
    List<WithdrawnMemberQueryResult> findWithdrawnMembersWithRawEmail();

    /**
     * 이메일을 다이제스트로 치환하고 탈퇴 시각을 채운다.
     *
     * <p>도메인 저장({@code save})을 쓰지 않는다 — 그 경로는 감사 컬럼 {@code updatedAt} 을
     * 현재 시각으로 올려 버리는데, 그 값이 여기서는 {@code withdrawnAt} 근사치의 유일한
     * 출처라서 마이그레이션이 중단·재개될 때 근사치가 망가진다.
     */
    void replaceWithdrawnEmail(long memberId, String emailDigest, LocalDateTime withdrawnAt);
}
