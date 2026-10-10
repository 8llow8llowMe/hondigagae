package com.hondigagae.domainlayer.emergency.domain.model;

import com.hondigagae.shared.travel.schedule.WeeklySchedule;
import java.time.LocalDateTime;

/**
 * "지금 영업 중인가" 판정.
 *
 * <p>목록과 상세가 <b>같은 답을 줘야 하므로</b> 규칙을 한곳에 둔다. 두 화면이 같은 시설을
 * 다르게 말하면 사용자는 어느 쪽도 믿지 않는다.
 *
 * <p>세 갈래다.
 * <ul>
 *   <li>영업시간 spec 이 있으면 그것으로 판정한다</li>
 *   <li>spec 이 없어도 24시간 확인 시설은 연 것으로 본다 - 상호의 "24시"만 보고 open24 가
 *       켜진 곳은 spec 이 없다</li>
 *   <li>둘 다 아니면 <b>모름(null)</b> 이다</li>
 * </ul>
 *
 * <p>null 이 이 규칙의 핵심이다. 제주 동물병원은 절반이 운영시간을 주지 않는데, 그것을
 * "닫힘"으로 접으면 급할 때 열려 있는 병원을 화면에서 지우게 된다. 모른다고 말하고
 * 전화 확인을 안내하는 편이 맞다.
 */
public final class FacilityOpenState {

    private FacilityOpenState() {
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
