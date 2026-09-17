package com.hondigagae.domainlayer.member.adapter.out.persistence;

import com.hondigagae.domainlayer.member.adapter.out.persistence.entity.MemberConsentEntity;
import com.hondigagae.domainlayer.member.adapter.out.persistence.repository.MemberConsentRepository;
import com.hondigagae.domainlayer.member.application.mapper.MemberConsentMapper;
import com.hondigagae.domainlayer.member.application.port.out.MemberConsentRepositoryPort;
import com.hondigagae.domainlayer.member.domain.model.MemberConsent;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MemberConsentRepositoryAdapter implements MemberConsentRepositoryPort {

    private final MemberConsentRepository memberConsentRepository;
    private final MemberConsentMapper memberConsentMapper;

    @Override
    public void saveAll(List<MemberConsent> consents) {
        List<MemberConsentEntity> entities = consents.stream()
            .map(memberConsentMapper::toEntityFromDomain)
            .toList();
        memberConsentRepository.saveAll(entities);
    }
}
