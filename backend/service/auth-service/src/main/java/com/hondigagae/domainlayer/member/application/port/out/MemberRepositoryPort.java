package com.hondigagae.domainlayer.member.application.port.out;

import com.hondigagae.domainlayer.member.domain.model.Member;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface MemberRepositoryPort {

    Member save(Member domain);

    Optional<Member> findByEmail(String email);

    /**
     * 주어진 값 중 하나라도 email 로 쓰이고 있는지 본다.
     *
     * <p>재가입 차단이 원문 하나로 끝나지 않기 때문에 계약 자체를 벌크로 둔다 — 탈퇴 회원의
     * email 은 다이제스트로 치환돼 있어서 원문과 다이제스트를 <b>한 번의 쿼리로</b> 함께 봐야
     * 한다 (coding-conventions §9-7).
     */
    boolean existsByEmailIn(List<String> emails);

    Optional<Member> findById(long memberId);

    /** 스토리지에 실제로 참조 중인 프로필 이미지 키 전부. 고아 객체 청소의 대조군이다. */
    List<String> findAllProfileImageKeys();

    /**
     * 보존 기간이 지난 탈퇴 회원의 아이디를 <b>최대 {@code limit} 건</b>까지.
     *
     * <p>{@code withdrawnAt} 이 null 인 행은 <b>기간 미경과로 취급해</b> 대상에서 빠진다.
     * 마이그레이션 전의 옛 탈퇴 행이 여기 해당하는데, 러너가 값을 채우고 나면 다음 실행부터
     * 정상적으로 잡힌다.
     *
     * <p><b>상한이 계약에 들어 있는 이유</b> — 호출부는 받은 아이디를 그대로 {@code in (...)} 으로
     * 되먹인다. 마이그레이션이 옛 탈퇴 행의 {@code withdrawnAt} 을 한꺼번에 채우면 그 다음 실행에
     * 전부가 한 번에 대상이 되어 파라미터 수천 개짜리 delete 가 나간다. 무제한 조회를 열어 두면
     * 호출부마다 자르는 것을 잊을 수 있어 포트 쪽에서 강제한다.
     */
    List<Long> findWithdrawnMemberIdsBefore(LocalDateTime threshold, int limit);

    /** 보존 기간이 지난 탈퇴 회원의 물리 삭제. 자식 행(pet/member_consent)을 먼저 지운 뒤 부른다. */
    void deleteAllByIdIn(List<Long> memberIds);
}
