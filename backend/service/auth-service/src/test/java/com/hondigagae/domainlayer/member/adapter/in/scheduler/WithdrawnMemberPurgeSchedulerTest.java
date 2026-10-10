package com.hondigagae.domainlayer.member.adapter.in.scheduler;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.member.application.port.out.MemberConsentRepositoryPort;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.application.service.processor.WithdrawnMemberPurgeProcessor;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.domainlayer.member.domain.model.MemberConsent;
import com.hondigagae.domainlayer.pet.application.port.out.PetRepositoryPort;
import com.hondigagae.domainlayer.pet.domain.model.Pet;
import com.hondigagae.security.common.enums.SecurityRole;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 보존 기간(30일)이 지난 탈퇴 회원 정리.
 *
 * <p>이 스케줄러는 되돌릴 수 없는 삭제를 하므로, 확인할 것은 <b>지우는 것</b>보다
 * <b>안 지우는 것</b> 쪽이 중요하다 — 기간이 지나지 않은 탈퇴 회원과 ACTIVE 회원이 남는가.
 */
class WithdrawnMemberPurgeSchedulerTest {

    private static final long EXPIRED_ID = 1L;
    private static final long RECENT_ID = 2L;
    private static final long ACTIVE_ID = 3L;
    private static final long NO_WITHDRAWN_AT_ID = 4L;
    /** 배치 분할을 보려면 대량 행이 필요하다. 위 고정 아이디와 겹치지 않는 대역에서 채운다. */
    private static final long FILLER_ID_BASE = 100L;
    /** 프로덕션 상수와 같은 값. 여기가 어긋나면 배치 경계를 검증하는 의미가 없어진다. */
    private static final int BATCH_SIZE = 1000;
    private static final int MAX_BATCHES_PER_RUN = 50;

    private StubMemberRepositoryPort memberRepositoryPort;
    private StubPetRepositoryPort petRepositoryPort;
    private RecordingConsentRepositoryPort consentRepositoryPort;
    private WithdrawnMemberPurgeScheduler scheduler;

    @BeforeEach
    void setUp() {
        memberRepositoryPort = new StubMemberRepositoryPort();
        petRepositoryPort = new StubPetRepositoryPort();
        consentRepositoryPort = new RecordingConsentRepositoryPort();
        scheduler = new WithdrawnMemberPurgeScheduler(new WithdrawnMemberPurgeProcessor(
            memberRepositoryPort, petRepositoryPort, consentRepositoryPort));

        LocalDateTime now = LocalDateTime.now();
        memberRepositoryPort.register(member(EXPIRED_ID, MemberStatus.WITHDRAWN, now.minusDays(31)));
        memberRepositoryPort.register(member(RECENT_ID, MemberStatus.WITHDRAWN, now.minusDays(29)));
        memberRepositoryPort.register(member(ACTIVE_ID, MemberStatus.ACTIVE, null));
        // 마이그레이션 전의 옛 탈퇴 행 — 탈퇴 시각을 알 수 없어 "기간 미경과"로 취급한다.
        memberRepositoryPort.register(member(NO_WITHDRAWN_AT_ID, MemberStatus.WITHDRAWN, null));
    }

    @Test
    @DisplayName("30일이 지난 탈퇴 회원만 지우고 미경과·ACTIVE 는 남긴다")
    void deletesOnlyExpiredWithdrawnMembers() {
        scheduler.purgeExpiredWithdrawnMembers();

        assertThat(memberRepositoryPort.findById(EXPIRED_ID)).isEmpty();
        assertThat(memberRepositoryPort.findById(RECENT_ID)).isPresent();
        assertThat(memberRepositoryPort.findById(ACTIVE_ID)).isPresent();
        assertThat(memberRepositoryPort.findById(NO_WITHDRAWN_AT_ID)).isPresent();
    }

    @Test
    @DisplayName("같은 회원의 반려견·동의 이력도 함께 지운다 — 남기면 주인 없는 고아 행이 된다")
    void deletesChildRowsOfPurgedMembers() {
        petRepositoryPort.register(10L, EXPIRED_ID);
        petRepositoryPort.register(11L, RECENT_ID);
        consentRepositoryPort.register(EXPIRED_ID);
        consentRepositoryPort.register(RECENT_ID);

        scheduler.purgeExpiredWithdrawnMembers();

        assertThat(petRepositoryPort.memberIdsById).containsOnlyKeys(11L);
        assertThat(consentRepositoryPort.memberIds).containsExactly(RECENT_ID);
    }

    @Test
    @DisplayName("대상이 없으면 자식 행에도 손대지 않는다")
    void touchesNothingWhenNoTargets() {
        memberRepositoryPort.deleteAllByIdIn(List.of(EXPIRED_ID));
        petRepositoryPort.register(11L, RECENT_ID);
        consentRepositoryPort.register(RECENT_ID);

        scheduler.purgeExpiredWithdrawnMembers();

        assertThat(petRepositoryPort.deleteCalls).isZero();
        assertThat(petRepositoryPort.memberIdsById).containsOnlyKeys(11L);
        assertThat(consentRepositoryPort.memberIds).containsExactly(RECENT_ID);
    }

    @Test
    @DisplayName("대상이 배치 상한을 넘으면 여러 번에 나눠 지운다 — in 절에 전부를 한 번에 싣지 않는다")
    void purgesInBatchesWhenTargetsExceedBatchSize() {
        // 마이그레이션이 옛 탈퇴 행의 withdrawnAt 을 한꺼번에 채운 직후의 모양이다.
        registerExpiredMembers(BATCH_SIZE);

        scheduler.purgeExpiredWithdrawnMembers();

        // setUp 의 1건 + 1000건 = 1001건이라 1000 + 1 두 배치로 나뉜다.
        assertThat(petRepositoryPort.deleteCalls).isEqualTo(2);
        // 나눠 지웠더라도 한 회차 안에서 대상이 전부 사라져야 한다 (기준은 스케줄러와 같은 30일).
        assertThat(memberRepositoryPort.findWithdrawnMemberIdsBefore(LocalDateTime.now().minusDays(30), BATCH_SIZE))
            .isEmpty();
        assertThat(memberRepositoryPort.findById(RECENT_ID)).isPresent();
    }

    @Test
    @DisplayName("삭제가 반영되지 않아도 한 회차 배치 상한에서 멈춘다 — 새벽 배치가 무한히 돌지 않는다")
    void stopsAtMaxBatchesWhenDeletionDoesNotTakeEffect() {
        registerExpiredMembers(BATCH_SIZE);
        // 예상 못 한 제약 위반으로 배치가 매번 롤백되는 상황. 종료 조건만 믿으면 같은 배치를 영원히 반복한다.
        memberRepositoryPort.deleteDisabled = true;

        scheduler.purgeExpiredWithdrawnMembers();

        assertThat(memberRepositoryPort.queryCalls).isEqualTo(MAX_BATCHES_PER_RUN);
    }

    private void registerExpiredMembers(int count) {
        LocalDateTime withdrawnAt = LocalDateTime.now().minusDays(31);
        for (int index = 0; index < count; index++) {
            memberRepositoryPort.register(member(FILLER_ID_BASE + index, MemberStatus.WITHDRAWN, withdrawnAt));
        }
    }

    private Member member(long id, MemberStatus status, LocalDateTime withdrawnAt) {
        return Member.builder()
            .id(id).email("member-" + id).name("테스터").nickname("테스터")
            .role(SecurityRole.USER).status(status).withdrawnAt(withdrawnAt)
            .build();
    }

    private static class StubMemberRepositoryPort implements MemberRepositoryPort {

        private final Map<Long, Member> members = new LinkedHashMap<>();
        private int queryCalls;
        /** 삭제가 반영되지 않는 상황(배치 롤백)을 흉내 낸다. */
        private boolean deleteDisabled;

        void register(Member member) {
            members.put(member.id(), member);
        }

        @Override
        public Member save(Member domain) {
            members.put(domain.id(), domain);
            return domain;
        }

        @Override
        public Optional<Member> findByEmail(String email) {
            return members.values().stream().filter(member -> member.email().equals(email)).findFirst();
        }

        @Override
        public boolean existsByEmailIn(List<String> emails) {
            return emails.stream().anyMatch(email -> findByEmail(email).isPresent());
        }

        @Override
        public Optional<Member> findById(long memberId) {
            return Optional.ofNullable(members.get(memberId));
        }

        @Override
        public List<String> findAllProfileImageKeys() {
            return List.of();
        }

        /** 실제 쿼리와 같은 규칙 — null 인 withdrawnAt 은 비교에서 빠지고, 결과는 상한까지만 나온다. */
        @Override
        public List<Long> findWithdrawnMemberIdsBefore(LocalDateTime threshold, int limit) {
            queryCalls++;
            return members.values().stream()
                .filter(member -> member.status() == MemberStatus.WITHDRAWN)
                .filter(member -> member.withdrawnAt() != null && member.withdrawnAt().isBefore(threshold))
                .map(Member::id)
                .sorted()
                .limit(limit)
                .toList();
        }

        @Override
        public void deleteAllByIdIn(List<Long> memberIds) {
            if (deleteDisabled) {
                return;
            }
            memberIds.forEach(members::remove);
        }
    }

    private static class RecordingConsentRepositoryPort implements MemberConsentRepositoryPort {

        private final List<Long> memberIds = new ArrayList<>();

        void register(long memberId) {
            memberIds.add(memberId);
        }

        @Override
        public void saveAll(List<MemberConsent> consents) {
            consents.forEach(consent -> memberIds.add(consent.memberId()));
        }

        @Override
        public void deleteAllByMemberIdIn(List<Long> targets) {
            memberIds.removeIf(targets::contains);
        }
    }

    /** 이 테스트는 반려견의 내용을 보지 않는다 — 어느 회원의 행이 지워지는지만 본다. */
    private static class StubPetRepositoryPort implements PetRepositoryPort {

        private final Map<Long, Long> memberIdsById = new LinkedHashMap<>();
        private int deleteCalls;

        void register(long petId, long memberId) {
            memberIdsById.put(petId, memberId);
        }

        @Override
        public Pet save(Pet domain) {
            return domain;
        }

        @Override
        public List<Pet> findAllByMemberId(long memberId) {
            return List.of();
        }

        @Override
        public Optional<Pet> findById(long petId) {
            return Optional.empty();
        }

        @Override
        public long countByMemberId(long memberId) {
            return 0;
        }

        @Override
        public List<String> findAllProfileImageKeys() {
            return List.of();
        }

        @Override
        public Optional<Pet> findRepresentativeByMemberId(long memberId) {
            return Optional.empty();
        }

        @Override
        public void deleteAllByMemberIdIn(List<Long> memberIds) {
            deleteCalls++;
            memberIdsById.values().removeIf(memberIds::contains);
        }
    }
}
