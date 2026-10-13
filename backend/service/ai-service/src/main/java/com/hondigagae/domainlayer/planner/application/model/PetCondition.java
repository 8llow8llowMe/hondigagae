package com.hondigagae.domainlayer.planner.application.model;

import com.hondigagae.shared.travel.pet.PetSizeType;
import java.math.BigDecimal;
import lombok.Builder;

/**
 * 일정 생성에 쓰는 반려견 특성. 프롬프트에 그대로 실리므로 값은 사람이 읽는 한국어 표현이다.
 *
 * <p>이 값이 없으면 "반려견 맞춤"이 성립하지 않는다 — 크기를 모르면 소형견 전용 카페를
 * 대형견 일정에 넣고, 더위 민감을 모르면 한여름 야외 일정을 짠다. 그래서 조회 실패 시에도
 * 잡은 계속 돌리되(auth 장애가 일정 생성 불가로 번지면 안 된다), 특성이 빠졌다는 사실을
 * 로그로 남긴다.
 *
 * <p>크기 · 체중은 표기({@code sizeName} · {@code weightText})와 원본 값({@code sizeType} · {@code weightKg})을 함께 든다.
 * 표기는 프롬프트 · 준비물이 쓰고, 원본 값은 후보 장소의 입장 판정({@link PetAdmission}, #1420)이 쓴다 — 표기를 다시
 * 값으로 읽어 판정하지 않는다.
 */
@Builder
public record PetCondition(
    String breed,
    String sizeName,
    // 크기 원본 값. 원천에 없거나 모르는 코드면 null — 입장 판정은 체중으로 크기를 가늠하거나 크기를 가리지 않는다 (#1420).
    PetSizeType sizeType,
    // 사람이 읽는 kg 표기 ("3.5"). 없으면 null — 지어 적지 않는다.
    String weightText,
    // 체중 원본 값(kg). 없으면 null — 입장 판정은 크기 구간의 하한(중형 10 · 대형 25kg)을 체중으로 쓴다 (#1420).
    BigDecimal weightKg,
    // 사람이 읽는 나이 표기 ("7년 4개월", "8개월"). 생년월을 모르면 null — 지어 적지 않는다.
    String ageText,
    // 생애 단계. 나이를 모르면 null — 모르는 것을 성견이라고 단정하지 않는다 (#493).
    PetLifeStage lifeStage,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    String activityName,
    boolean walkPreferred,
    // 사회성 낮음 - 다른 개나 낯선 사람을 불편해한다. 보통/높음은 제약이 아니라 플래그로 접는다.
    boolean lowSociality
) {
}
