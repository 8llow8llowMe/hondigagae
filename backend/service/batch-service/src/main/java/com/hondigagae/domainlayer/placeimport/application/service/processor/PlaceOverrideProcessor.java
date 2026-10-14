package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.model.PlaceOverrideOutcome;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceOverrideCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceOverrideCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceOverrideTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.OverridablePlace;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceOverride;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 근거를 적은 장소 보정을 place 행에 적용한다 (#1434).
 *
 * <p><b>왜 스텝으로 다시 쓰는가.</b> 원천을 고칠 수 없는 장소(원천끼리 어긋나거나 원천이 화면에 틀린 말을 하게 하는 곳)를 사람이 고칠
 * 장치가 없었고, 수동 UPDATE 는 살아남지 못했다 — {@code placePetAllowanceReflectStep} 이 {@code pet_allowance_type} · {@code allowed_pet_size} ·
 * {@code pet_available} 을 매 실행 처음부터 다시 계산하고, 문화정보원 · 식약처 적재가 자기 행의 칸을 매번 덮는다. 그래서 원천 적재 · 병합처럼
 * 이 칸들을 다시 쓰는 스텝 <b>뒤</b>에 매번 보정을 다시 얹는다(배치 순서는 {@code PlaceOverrideStepConfig}).
 *
 * <ol>
 *   <li>파일을 읽는다 — 항목 하나라도 규칙을 어기면 스텝이 실패한다({@code PLACE_OVERRIDE_INVALID}).</li>
 *   <li>대상 행을 한 번의 {@code IN} 조회로 읽는다.</li>
 *   <li>없는 id · 제목이 다른 행은 건너뛰고 WARN 을 남긴다 — id 가 다른 장소를 가리키게 되었을 때 엉뚱한 곳을 고치지 않는다.
 *       판정은 도메인 {@link PlaceOverride#appliesTo} 한 곳이다.</li>
 *   <li>지금 값에 보정을 얹은 결과({@link PlaceOverride#applyTo})가 지금과 같으면 쓰지 않는다. 나머지를 한 번에 쓴다 — 값은 Java 에서 합치고
 *       SQL 은 평범한 파라미터로 쓴다({@code JdbcPlaceOverrideAdapter} 의 {@code BIT(1)} 설명).</li>
 * </ol>
 *
 * <p><b>보정이 이긴다 — 재계산은 보정된 칸을 건드리지 않는다.</b> 동반 구분을 보정한 행은 재계산({@code PlacePetAllowanceReflectProcessor})이
 * 같은 보정 목록과 같은 판정({@link PlaceOverride#appliesTo})으로 걸러 낸다. 그래서 두 스텝이 서로 되돌리지 않고, 보정이 한 번 들어간 뒤에는
 * 이 스텝도 쓸 것이 없다(멱등).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlaceOverrideProcessor {

    private final PlaceOverrideCatalogPort placeOverrideCatalogPort;
    private final PlaceOverrideCommandPort placeOverrideCommandPort;

    public PlaceOverrideOutcome applyOverrides() {
        List<PlaceOverride> overrides = placeOverrideCatalogPort.readOverrides();
        if (overrides.isEmpty()) {
            log.info("place overrides finished. entries=0");
            return new PlaceOverrideOutcome(0, 0, 0, 0, 0);
        }

        Map<Long, PlaceOverrideTargetQueryResult> targets = placeOverrideCommandPort.findTargets(overrides.stream().map(PlaceOverride::placeId).toList())
            .stream()
            .collect(Collectors.toMap(PlaceOverrideTargetQueryResult::placeId, Function.identity()));

        int applied = 0;
        int skippedNotFound = 0;
        int skippedTitleMismatch = 0;
        List<OverridablePlace> changes = new ArrayList<>();
        for (PlaceOverride override : overrides) {
            PlaceOverrideTargetQueryResult target = targets.get(override.placeId());
            if (target == null) {
                skippedNotFound++;
                log.warn("place override skipped. reason=not_found, placeId={}, expectedTitle={}", override.placeId(), override.expectedTitle());
                continue;
            }
            // 적용 판정은 도메인 한 곳이다 — 동반 재계산도 같은 판정으로 보정 행을 뺀다
            if (!override.appliesTo(target.placeId(), target.title())) {
                skippedTitleMismatch++;
                log.warn("place override skipped. reason=title_mismatch, placeId={}, expectedTitle={}, actualTitle={}",
                    override.placeId(), override.expectedTitle(), target.title());
                continue;
            }
            applied++;
            OverridablePlace current = target.toOverridablePlace();
            OverridablePlace next = override.applyTo(current);
            boolean changed = !next.equals(current);
            if (changed) {
                changes.add(next);
            }
            log.info("place override applied. placeId={}, title={}, source={}, changed={}, indoor={}, outdoor={}, petAllowanceType={}, allowedPetSize={}, "
                    + "petAvailable={}",
                override.placeId(), target.title(), target.source(), changed, transition(current.indoor(), next.indoor()),
                transition(current.outdoor(), next.outdoor()), transition(current.petAllowanceType(), next.petAllowanceType()),
                transition(current.allowedPetSize(), next.allowedPetSize()), transition(current.petAvailable(), next.petAvailable()));
        }

        int changed = changes.isEmpty() ? 0 : placeOverrideCommandPort.applyOverrides(changes);
        PlaceOverrideOutcome outcome = new PlaceOverrideOutcome(overrides.size(), applied, changed, skippedNotFound, skippedTitleMismatch);
        log.info("place overrides finished. entries={}, applied={}, changed={}, skippedNotFound={}, skippedTitleMismatch={}",
            outcome.entries(), outcome.applied(), outcome.changed(), outcome.skippedNotFound(), outcome.skippedTitleMismatch());
        return outcome;
    }

    /** 바뀌는 칸은 {@code 지금->보정 뒤}, 그대로인 칸은 지금 값만. */
    private static String transition(Object current, Object next) {
        return Objects.equals(current, next) ? String.valueOf(current) : current + "->" + next;
    }
}
