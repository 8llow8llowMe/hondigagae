package com.hondigagae.domainlayer.member.adapter.out.persistence;

import com.hondigagae.domainlayer.member.adapter.out.persistence.repository.MemberRepository;
import com.hondigagae.domainlayer.member.application.port.out.WithdrawnEmailMigrationPort;
import com.hondigagae.domainlayer.member.application.port.out.query.WithdrawnMemberQueryResult;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * #609 일회성 마이그레이션 어댑터. 포트와 함께 제거될 코드다.
 */
@Component
@RequiredArgsConstructor
public class WithdrawnEmailMigrationAdapter implements WithdrawnEmailMigrationPort {

    private final MemberRepository memberRepository;

    @Override
    public List<WithdrawnMemberQueryResult> findWithdrawnMembersWithRawEmail() {
        return memberRepository.findWithdrawnMembersWithRawEmail(MemberStatus.WITHDRAWN);
    }

    @Override
    // 벌크 update 는 쓰기 트랜잭션을 요구한다. 행 단위로 커밋해 중간에 끊겨도 처리한 만큼은 남긴다.
    @Transactional
    public void replaceWithdrawnEmail(long memberId, String emailDigest, LocalDateTime withdrawnAt) {
        memberRepository.replaceWithdrawnEmail(memberId, emailDigest, withdrawnAt);
    }
}
