package com.hondigagae.domainlayer.member.application.port.out;

import com.hondigagae.domainlayer.member.domain.model.MemberConsent;
import java.util.List;

public interface MemberConsentRepositoryPort {

    /**
     * 동의 이력을 한 번에 저장한다. 가입 한 건이 항상 여러 항목을 함께 남기므로, 단건 save 를
     * 반복 호출하지 않도록 계약 자체를 벌크로 둔다 (coding-conventions §9-7).
     */
    void saveAll(List<MemberConsent> consents);

    /**
     * 회원의 동의 이력을 물리 삭제한다. 보존 기간이 지난 탈퇴 회원 정리 전용이다 — 회원 행이
     * 사라진 뒤의 동의 이력은 누구의 것인지 확인할 수 없어 감사 가치가 없다.
     */
    void deleteAllByMemberIdIn(List<Long> memberIds);
}
