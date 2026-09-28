package com.hondigagae.domainlayer.pet.application.port.out;

/**
 * 반려견 삭제를 일정 동행 목록에 반영해 달라고 plan-service 에 요청한다 (#972).
 *
 * <p>일정의 원천은 plan-service 라 auth 는 일정을 직접 고치지 않는다. 보내는 것은 "이 petId 를 떼라" 는
 * 명령이 아니라 "이 회원을 지금 대사하라" 는 트리거다 — plan 이 auth 에 살아 있는 반려견을 다시 묻고
 * 없는 아이만 뗀다.
 *
 * <p><b>던지지 않는다.</b> 대상 서비스 다운·서킷 오픈·타임아웃·옛 버전(경로 없음 404) 어느 것이든
 * 경고 로그로 남기고 돌아온다. 삭제는 이미 커밋됐고, 못 한 몫은 plan-service 의 04:10 대사 배치가 이어받는다.
 */
public interface PlanCompanionCommandPort {

    /**
     * @param memberId     대사할 회원
     * @param deletedPetId 방금 지운 반려견 — 요청에는 싣지 않고 로그의 상관 키로만 쓴다
     */
    void reconcileCompanions(long memberId, long deletedPetId);
}
