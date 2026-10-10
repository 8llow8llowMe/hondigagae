package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.shared.travel.insight.WalkSafetyLevel;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * 오늘 남은 시간 중 산책하기 가장 좋은 연속 구간.
 *
 * <p><b>{@code WalkSafetyEvaluator} 의 saferWindow 와 고르는 기준이 다르다.</b> 그쪽은 "지금
 * 위험하니 조금 뒤에 나가라"는 조언이라 <b>가장 이른</b> 괜찮은 구간을 준다. 이쪽은 "오늘
 * 언제가 제일 낫냐"는 질문이라 <b>가장 좋은</b> 구간을 준다.
 *
 * <p>고르는 순서는 이렇다.
 * <ol>
 *   <li><b>등급</b> — 안전 구간이 있으면 주의 구간보다 먼저다</li>
 *   <li><b>길이</b> — 같은 등급이면 긴 쪽. 30분짜리 안전 구간보다 세 시간이 쓸모 있다</li>
 *   <li><b>이른 시각</b> — 둘 다 같으면 앞선 쪽. 같은 조건에서 답이 흔들리면 안 된다</li>
 * </ol>
 */
public record GoldenWalkWindow(
    LocalDateTime start,
    LocalDateTime end,
    WalkSafetyLevel level
) {

    /**
     * 곡선에서 가장 좋은 구간을 찾는다.
     *
     * <p><b>위험 등급뿐인 날에는 비어 있다.</b> 아무 구간이나 골라 "이때가 그나마 낫다"고
     * 말하면 사용자는 그것을 허락으로 읽는다. 오늘은 나가지 말라고 말하는 편이 맞다.
     */
    public static Optional<GoldenWalkWindow> from(List<HourlyWalkSafety> curve) {
        List<GoldenWalkWindow> runs = acceptableRuns(curve);
        if (runs.isEmpty()) {
            return Optional.empty();
        }
        return runs.stream().max(
            Comparator.comparingInt((GoldenWalkWindow run) -> run.level() == WalkSafetyLevel.SAFE ? 1 : 0)
                .thenComparingLong(GoldenWalkWindow::minutes)
                .thenComparing(GoldenWalkWindow::start, Comparator.reverseOrder()));
    }

    /**
     * 연속으로 받아들일 만한 구간들.
     *
     * <p>안전과 주의가 섞인 구간은 <b>주의 구간으로 본다.</b> 좋은 쪽으로 접으면 위험을
     * 낮춰 말하게 된다.
     */
    private static List<GoldenWalkWindow> acceptableRuns(List<HourlyWalkSafety> curve) {
        List<GoldenWalkWindow> runs = new ArrayList<>();
        if (curve == null || curve.isEmpty()) {
            return runs;
        }

        LocalDateTime start = null;
        LocalDateTime end = null;
        WalkSafetyLevel worst = null;
        for (HourlyWalkSafety point : curve) {
            if (point.isAcceptable()) {
                if (start == null) {
                    start = point.at();
                    worst = point.level();
                } else {
                    worst = worst.worseOf(point.level());
                }
                end = point.at();
            } else if (start != null) {
                runs.add(new GoldenWalkWindow(start, end, worst));
                start = null;
            }
        }
        if (start != null) {
            runs.add(new GoldenWalkWindow(start, end, worst));
        }
        return runs;
    }

    public long minutes() {
        return Duration.between(start, end).toMinutes();
    }
}
