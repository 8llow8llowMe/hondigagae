package com.hondigagae.domainlayer.member.adapter.out.persistence;

import com.hondigagae.domainlayer.member.adapter.out.persistence.entity.MemberEntity;
import com.hondigagae.domainlayer.member.adapter.out.persistence.repository.MemberRepository;
import com.hondigagae.domainlayer.member.application.mapper.MemberMapper;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.model.Member;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
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
    public boolean existsByEmail(String email) {
        return memberRepository.existsByEmail(email);
    }

    @Override
    public Optional<Member> findByEmail(String email) {
        return memberRepository.findByEmail(email)
            .map(memberMapper::toDomainFromEntity);
    }

    @Override
    public Optional<Member> findById(long memberId) {
        return memberRepository.findById(memberId)
            .map(memberMapper::toDomainFromEntity);
    }

    @Override
    public java.util.List<String> findAllProfileImageKeys() {
        return memberRepository.findAllProfileImageKeys();
    }
}
