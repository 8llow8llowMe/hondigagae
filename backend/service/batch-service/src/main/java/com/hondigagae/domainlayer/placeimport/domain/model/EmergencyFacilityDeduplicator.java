package com.hondigagae.domainlayer.placeimport.domain.model;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 긴급 시설 적재 직전의 중복 접기.
 *
 * <h2>왜 필요한가</h2>
 *
 * <p>유일성 기준이 {@code sourceKey}({@code SHA-256(이름|주소)}) 하나뿐이라, 원천이 같은 시설을
 * <b>표기만 달리해</b> 넣은 행이 각각 별개 시설로 적재된다. dev 에서 실제로 나온 쌍이다 (#569):
 *
 * <pre>
 * 24시똑똑똑 동물메디컬센터   제주시 도령로 129   064-749-7585
 * 24시똑똑똑동물메디컬센터    제주시 도령로 129   064-749-7585
 * </pre>
 *
 * <p>{@link PlaceIdFactory#sourceKeyOf} 안의 정규화는 공백 <b>런</b>을 한 칸으로 접을 뿐
 * 내부 공백을 없애지 않아 둘이 다른 키가 된다.
 *
 * <h2>왜 여기서 접는가 — {@code sourceKeyOf} 를 고치지 않는 이유</h2>
 *
 * <p>{@code sourceKeyOf} 는 {@code emergency_facility} 말고 {@code place}(CULTURE_PORTAL·MFDS)도
 * 쓴다. 정규화를 강화하면 주소에 공백이 없는 행이 0건이라 <b>place id 가 전국 3,516키 전부 바뀌는데,
 * place 쪽에서 실제로 접히는 건수는 0</b>이다 (전국 CSV 실측). 얻는 것 없이
 * {@code favorite.place_id} · {@code plan_item.target_id} · {@code place_image} 참조만 끊긴다.
 *
 * <p>여기서 접으면 <b>생존 행의 id 가 그대로 유지된다.</b> 접혀서 upsert 되지 않은 행은
 * {@code synced_at} 이 낡아 같은 잡의 delist 가 {@code delisted_at} 을 찍고 조회에서 사라진다 —
 * 마이그레이션 SQL 도 스키마 변경도 필요 없다.
 *
 * <h2>접지 않는 것</h2>
 *
 * <p>{@code 노형 꿈 동물병원}(월광로 32)과 {@code 노형꿈동물병원}(우령서로 89)은 전화가 같지만
 * <b>3,502m 떨어져 있고</b> 법정동·좌표·휴무일·주차 여부·설명이 전부 다르다. 이전(移轉)인지
 * 2호점인지 원천만으로는 판정할 수 없어 <b>접지 않는다</b> —
 * {@link PlaceIdentityPolicy#EMERGENCY_DUPLICATE_RADIUS_M} 이 이 판단을 고정한다.
 */
public final class EmergencyFacilityDeduplicator {

    private EmergencyFacilityDeduplicator() {
    }

    /**
     * 접은 결과.
     *
     * @param facilities upsert 할 행. <b>입력 순서가 아니다</b> — 접을 수 없는 행이 앞, 나머지가 뒤다.
     *                   접고 나면 {@code sourceKey} 가 전부 유일해 upsert 결과는 순서와 무관하다
     * @param mergedNotes 접힌 조합의 사람이 읽을 설명. 적재 로그에 남겨 원천 품질을 추적한다
     * @param conflictNotes 같은 시설로 보이는데 <b>운영 정보가 엇갈려</b> 접지 않은 조합.
     *                      원천이 고쳐지기 전까지 목록에 두 번 뜨므로 추적해야 한다
     */
    public record Result(
        List<ImportedEmergencyFacility> facilities,
        List<String> mergedNotes,
        List<String> conflictNotes) {
    }

    /**
     * 같은 시설로 판정되는 행을 하나로 접는다.
     *
     * <p>두 단계다.
     * <ol>
     *   <li>{@code sourceKey} 가 같은 행을 접는다. 지금까지 DB 의 {@code ON DUPLICATE KEY UPDATE} 가
     *       하던 일을 앞으로 당긴 것이라 <b>결과가 같아야 한다</b> — 그래서 배치 적용 순서와 같이
     *       <b>나중 행이 이긴다.</b></li>
     *   <li>(종류, 정규화 이름, 전화 숫자)로 묶고, 묶음 안이 전부
     *       {@link PlaceIdentityPolicy#EMERGENCY_DUPLICATE_RADIUS_M} 이내일 때만 하나로 접는다.</li>
     * </ol>
     *
     * <p><b>묶음 안에 한 쌍이라도 멀면 그 묶음은 통째로 남긴다.</b> 일부만 접으면 "어느 것이 어느 것과
     * 같은가" 를 순서가 정하게 되는데, 그 판단의 근거가 원천에 없다. 전부 남기는 쪽이 정직하다.
     */
    public static Result fold(List<ImportedEmergencyFacility> facilities) {
        List<ImportedEmergencyFacility> distinct = foldBySourceKey(facilities);

        // 이름·전화가 같은 것끼리만 모은다. 거리 계산은 이 묶음 안에서만 하므로 전국 12,930행에서도 싸다
        Map<String, List<ImportedEmergencyFacility>> buckets = new LinkedHashMap<>();
        List<ImportedEmergencyFacility> unfoldable = new ArrayList<>();

        for (ImportedEmergencyFacility facility : distinct) {
            String key = bucketKeyOf(facility);
            if (key == null) {
                unfoldable.add(facility);
                continue;
            }
            buckets.computeIfAbsent(key, ignored -> new ArrayList<>()).add(facility);
        }

        List<ImportedEmergencyFacility> kept = new ArrayList<>(unfoldable);
        List<String> mergedNotes = new ArrayList<>();
        List<String> conflictNotes = new ArrayList<>();

        for (List<ImportedEmergencyFacility> bucket : buckets.values()) {
            if (bucket.size() == 1 || !allWithinRadius(bucket)) {
                kept.addAll(bucket);
                continue;
            }
            if (hasConflictingHours(bucket)) {
                kept.addAll(bucket);
                conflictNotes.add(bucket.stream()
                    .map(row -> "%s(%s) 운영시간=%s 휴무=%s".formatted(
                        row.name(), row.addr(), row.operatingHours(), row.restDate()))
                    .collect(Collectors.joining(" | ")));
                continue;
            }

            ImportedEmergencyFacility survivor = bucket.stream().min(bySurvivalOrder()).orElseThrow();
            kept.add(survivor);
            bucket.stream()
                .filter(dropped -> !dropped.sourceKey().equals(survivor.sourceKey()))
                .forEach(dropped -> mergedNotes.add("%s(%s) <- %s(%s)".formatted(
                    survivor.name(), survivor.addr(), dropped.name(), dropped.addr())));
        }

        return new Result(kept, mergedNotes, conflictNotes);
    }

    /**
     * 운영 정보가 엇갈리는가. <b>엇갈리면 접지 않는다.</b>
     *
     * <p>전국 실측에서 접기 후보 10개 묶음 중 <b>5개가 운영시간이 서로 달랐다</b> —
     * {@code 24시 지구촌 동물메디컬 센터}는 {@code 매일 00:00~24:00}, 같은 전화·같은 이름의 다른 행은
     * {@code 매일 09:00~23:00} 이다. 둘 중 하나를 임의로 고르면 <b>24시간 병원이 아닌 곳이 되거나 그
     * 반대가 된다</b> — 급할 때 찾는 화면에서 가장 나쁜 종류의 오류다.
     *
     * <p>그래서 <b>어느 쪽이 맞는지 원천이 말해 주지 않으면 접지 않는다.</b> 목록에 두 번 뜨는 것이
     * 틀린 시간을 하나만 뜨게 하는 것보다 낫다. 대신 {@link Result#conflictNotes} 로 남겨 원천이
     * 고쳐지는지 추적한다.
     *
     * <p>한쪽만 값을 가진 경우는 엇갈림이 아니다 — 그때는 값을 가진 쪽이 생존한다
     * ({@link #bySurvivalOrder}).
     */
    private static boolean hasConflictingHours(List<ImportedEmergencyFacility> bucket) {
        return conflicts(bucket, ImportedEmergencyFacility::operatingHours)
            || conflicts(bucket, ImportedEmergencyFacility::restDate);
    }

    private static boolean conflicts(
        List<ImportedEmergencyFacility> bucket, Function<ImportedEmergencyFacility, String> field) {
        // null 은 "모름" 이라 엇갈림이 아니다. 값이 둘 이상 나오는 경우만 엇갈림이다
        return bucket.stream().map(field).filter(Objects::nonNull).distinct().count() > 1;
    }

    private static List<ImportedEmergencyFacility> foldBySourceKey(List<ImportedEmergencyFacility> facilities) {
        Map<String, ImportedEmergencyFacility> byKey = new LinkedHashMap<>();
        for (ImportedEmergencyFacility facility : facilities) {
            // put 은 값만 덮고 자리는 처음 그대로다 — 나중 행이 이기면서 입력 순서도 보존된다
            byKey.put(facility.sourceKey(), facility);
        }
        return new ArrayList<>(byKey.values());
    }

    /**
     * 접기 후보를 모을 키. <b>접을 수 없는 행은 {@code null}</b> — 전화가 없거나 좌표가 없으면
     * 거리 가드를 걸 수 없고, 가드 없는 이름 접기는 실측으로 검증하지 않았다.
     */
    private static String bucketKeyOf(ImportedEmergencyFacility facility) {
        // 전화 정규화는 정책이 소유한다 — 여기서 따로 구현하면 버킷과 판정이 갈라진다
        String tel = PlaceIdentityPolicy.telDigitsOf(facility.tel());
        String name = PlaceNameMatcher.normalize(facility.name());
        if (tel.isEmpty() || name.isEmpty() || facility.lat() == null || facility.lng() == null) {
            return null;
        }
        return facility.facilityType().name() + "|" + name + "|" + tel;
    }

    /** 묶음 안의 모든 쌍이 상한 안에 있는가. 묶음은 2~3개라 전수 비교가 싸다. */
    private static boolean allWithinRadius(List<ImportedEmergencyFacility> bucket) {
        for (int i = 0; i < bucket.size(); i++) {
            for (int j = i + 1; j < bucket.size(); j++) {
                ImportedEmergencyFacility left = bucket.get(i);
                ImportedEmergencyFacility right = bucket.get(j);
                double distance = PlaceNameMatcher.distanceMeters(
                    left.lat().doubleValue(), left.lng().doubleValue(),
                    right.lat().doubleValue(), right.lng().doubleValue());
                if (!PlaceIdentityPolicy.isSameEmergencyFacility(
                    left.name(), left.tel(), right.name(), right.tel(), distance)) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * 어느 행을 남길지. <b>결정적이어야 한다</b> — 실행할 때마다 다른 행이 살아남으면 id 가 흔들려
     * 멱등성이 깨진다.
     *
     * <p><b>운영시간이 있는 쪽이 먼저다.</b> 이 원천은 결측이 많아(동물병원 114/225 만 운영시간을 준다)
     * 한쪽만 시간을 가진 중복 쌍이 흔하고, 시간 없는 쪽이 이기면 급할 때 찾는 화면이 "정보 없음" 이
     * 된다. 접기 전에는 두 행이 다 떠서 사용자가 시간 있는 쪽을 볼 수 있었으므로, 그대로 두면
     * <b>접기가 정보를 줄이는 변경</b>이 된다.
     *
     * <p><b>행을 통째로 남기고 필드를 섞지 않는다.</b> {@code open24}·{@code weeklyHoursSpec} 은
     * 이름과 운영시간에서 파생한 값이라, 다른 행의 시간만 끌어오면 파생값과 어긋난다.
     * 시간이 서로 엇갈리는 묶음은 애초에 접지 않으므로({@link #hasConflictingHours}) 섞을 일도 없다.
     *
     * <p>그다음은 {@code sourceModifiedAt} 최신 → 없는 쪽이 뒤 → 동률이면 {@code sourceKey} 사전순.
     * {@code sourceKey} 는 접기 전에 이미 유일해져 있어 항상 타이를 깬다.
     */
    private static Comparator<ImportedEmergencyFacility> bySurvivalOrder() {
        return Comparator
            .comparing((ImportedEmergencyFacility row) -> row.operatingHours() == null)
            .thenComparing(ImportedEmergencyFacility::sourceModifiedAt,
                Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(ImportedEmergencyFacility::sourceKey);
    }
}
