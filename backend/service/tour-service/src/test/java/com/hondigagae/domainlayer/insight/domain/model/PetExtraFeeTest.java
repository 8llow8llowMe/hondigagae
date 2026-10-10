package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.model.PetExtraFee.Kind;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * 추가 요금 원문 해석 (#231). 원천이 요금 없음을 "없음" 이라는 낱말로 보내므로 값의 존재가 아니라 뜻을 읽어야 한다.
 */
class PetExtraFeeTest {

    @ParameterizedTest(name = "\"{0}\" → 요금 없음")
    @ValueSource(strings = {"없음", "없음.", "(없음)", "없 음", "무료", "0원", "0", "해당없음", "해당 사항 없음", "-", "X", "추가 요금 없음", "추가요금 없습니다"})
    @DisplayName("부정 표현은 요금 없음이다 — 감점도 근거 문장도 만들지 않는다")
    void negationsMeanNoFee(String raw) {
        PetExtraFee fee = PetExtraFee.of(raw);

        assertThat(fee.kind()).isEqualTo(Kind.NONE);
        assertThat(fee.isCharged()).isFalse();
    }

    @ParameterizedTest(name = "\"{0}\" → 요금 있음")
    @ValueSource(strings = {"20,000원", "10,000원", "1만원", "5000", "유료", "별도 요금 있음", "1마리당 3,000원 부과", "무료(소형견), 대형견 5,000원"})
    @DisplayName("금액이나 유료 표현이 있으면 요금 있음이다 — 부정 낱말이 섞여도 금액이 우선")
    void amountsMeanCharged(String raw) {
        PetExtraFee fee = PetExtraFee.of(raw);

        assertThat(fee.kind()).isEqualTo(Kind.CHARGED);
        assertThat(fee.isCharged()).isTrue();
        assertThat(fee.raw()).isEqualTo(raw);
    }

    @ParameterizedTest(name = "\"{0}\" → 판정 불가")
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "별도 문의", "시설에 문의"})
    @DisplayName("빈 값과 뜻을 읽을 수 없는 원문은 판정하지 않는다 — 모르는 것을 나쁘다고 말하지 않는다")
    void unreadableIsUnknown(String raw) {
        PetExtraFee fee = PetExtraFee.of(raw);

        assertThat(fee.kind()).isEqualTo(Kind.UNKNOWN);
        assertThat(fee.isCharged()).isFalse();
    }
}
