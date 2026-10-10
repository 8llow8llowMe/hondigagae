package com.hondigagae.domainlayer.member.adapter.out.persistence;

import com.hondigagae.domainlayer.member.adapter.out.persistence.entity.MemberEntity;
import com.hondigagae.domainlayer.member.adapter.out.persistence.repository.MemberRepository;
import com.hondigagae.domainlayer.member.application.mapper.MemberMapper;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.model.Member;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MemberRepositoryAdapter implements MemberRepositoryPort {

    private final MemberRepository memberRepository;
    private final MemberMapper memberMapper;

    @Override
    public Member save(Member domain) {
        MemberEntity entity = memberMapper.toEntityFromDomain(domain);
        MemberEntity savedEntity = memberRepository.save(entity);
        return memberMapper.toDomainFromEntity(savedEntity);
    }

    @Override
    public Optional<Member> findByEmail(String email) {
        return memberRepository.findByEmail(email)
            .map(memberMapper::toDomainFromEntity);
    }

    @Override
    public boolean existsByEmailIn(List<String> emails) {
        return memberRepository.existsByEmailIn(emails);
    }

    @Override
    public Optional<Member> findById(long memberId) {
        return memberRepository.findById(memberId)
            .map(memberMapper::toDomainFromEntity);
    }

    @Override
    public List<String> findAllProfileImageKeys() {
        return memberRepository.findAllProfileImageKeys();
    }

    @Override
    public List<Long> findWithdrawnMemberIdsBefore(LocalDateTime threshold, int limit) {
        // 항상 첫 페이지만 읽는다 — 읽은 만큼 지우므로 offset 을 밀면 오히려 대상을 건너뛴다.
        return memberRepository.findIdsByStatusAndWithdrawnAtBefore(
            MemberStatus.WITHDRAWN, threshold, PageRequest.of(0, limit));
    }

    @Override
    public void deleteAllByIdIn(List<Long> memberIds) {
        // 영속성 컨텍스트를 거치지 않는 단일 delete 문. 지우는 행을 다시 읽을 일이 없다.
        memberRepository.deleteAllByIdInBatch(memberIds);
    }
}
