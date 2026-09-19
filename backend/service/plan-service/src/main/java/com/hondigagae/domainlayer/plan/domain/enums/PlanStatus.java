package com.hondigagae.domainlayer.plan.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import java.util.List;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 일정 상태.
 *
 * <p>{@link CodeNameDescribable} 을 구현해 {@code toMetadata()} 하나로 응답 메타데이터를 만든다 —
 * 일정 상세와 공유 링크 조회가 각자 변환 메서드를 들고 있으면 한쪽만 고쳐질 자리가 된다.
 * 같은 서비스의 {@code PlanDayWeatherUnavailableReason} 이 이미 쓰는 방식이다.
 */
@Getter
@RequiredArgsConstructor
public enum PlanStatus implements CodeNameDescribable {

    DRAFT("초안", "AI 또는 사용자가 작성 중인 일정입니다."),
    CONFIRMED("확정", "여행이 확정된 일정입니다."),
    COMPLETED("완료", "여행을 마친 일정입니다.");

    /**
     * 동행 반려견을 아직 바꿀 수 있는 상태 — <b>이 상수가 유일한 정의</b>다.
     *
     * <p>완료({@link #COMPLETED})된 일정은 다녀온 기록이라 동행견이 잠긴다 — 수정 경로가
     * {@code PLAN_019} 로 막는 것과 <b>같은 선</b>이다. 반려견 프로필이 삭제됐을 때 돌리는
     * 대사 배치도 이 선을 넘지 않는다. 넘으면 사용자가 손으로는 바꿀 수 없는 기록을 배치가
     * 말없이 바꾸게 된다.
     *
     * <p>JPQL {@code in} 절({@link #companionEditableStatuses()})과 애플리케이션 판정
     * ({@link #isCompanionEditable()})이 <b>둘 다 이 상수만 본다</b>. 상태가 늘어날 때 한 곳만 고치면 된다.
     */
    private static final List<PlanStatus> COMPANION_EDITABLE = List.of(DRAFT, CONFIRMED);

    private final String displayName;
    private final String description;

    /**
     * 읽기 전용 공유 링크로 열어도 되는 상태인가.
     *
     * <p>초안({@link #DRAFT})은 아직 다듬는 중이라 남에게 보이지 않는다. 확정·완료만 공유한다.
     *
     * <p><b>발급 시점과 공개 조회 시점 양쪽에서 본다.</b> 발급 때만 보면 확정한 뒤 초안으로
     * 되돌린 일정이 이미 나간 링크로 계속 열린다 — 사용자는 "초안으로 되돌렸으니 안 보이겠지" 로
     * 읽는다. 판정이 여기 한 곳에 있어야 두 시점이 서로 다르게 굴지 않는다.
     */
    public boolean isShareable() {
        return this != DRAFT;
    }

    /** 동행견 정리 쿼리의 {@code in} 절에 싣는 상태 목록. 정의는 {@link #COMPANION_EDITABLE} 하나뿐이다. */
    public static List<PlanStatus> companionEditableStatuses() {
        return COMPANION_EDITABLE;
    }

    /** 쿼리가 거른 것과 <b>같은 기준</b>으로 한 건을 다시 확인한다 (정리 트랜잭션 안의 재확인). */
    public boolean isCompanionEditable() {
        return COMPANION_EDITABLE.contains(this);
    }
}
