package com.hondigagae.domainlayer.place.domain.model;

import com.hondigagae.shared.travel.schedule.WeeklySchedule;
import java.time.LocalDateTime;

/**
 * "지금 영업 중인가" 판정 — 여행 장소용.
 *
 * <p>emergency 컨텍스트의 {@code FacilityOpenState} 와 같은 규칙이다. 같은 사용자가 긴급 시설과
 * 여행 장소를 오가며 보므로 두 판정이 갈리면 안 된다. 컨텍스트 경계 때문에 클래스는 공유하지
 * 않는다 — 규칙을 바꿀 일이 생기면 둘을 같이 바꾸고, 세 번째 사용처가 생기면 shared-travel
 * 승격을 검토한다.
 *
 * <p>세 갈래다.
 * <ul>
 *   <li>영업시간 spec 이 있으면 그것으로 판정한다</li>
 *   <li>spec 이 없어도 24시간 확인 장소는 연 것으로 본다</li>
 *   <li>둘 다 아니면 <b>모름(null)</b> 이다 — 원문을 못 푼 장소를 "닫힘"으로 접으면
 *       열려 있는 장소가 화면에서 지워진다</li>
 * </ul>
 */
public final class PlaceOpenState {

    private PlaceOpenState() {
    }

    /** @return 열림/닫힘, 또는 판정할 수 없으면 null */
    public static Boolean resolve(String weeklyHoursSpec, boolean open24, LocalDateTime now) {
        WeeklySchedule schedule = WeeklySchedule.parseSpec(weeklyHoursSpec);
        if (schedule != null) {
            return schedule.isOpenAt(now);
        }
        return open24 ? Boolean.TRUE : null;
    }
}
