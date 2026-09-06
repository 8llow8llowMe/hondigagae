package com.hondigagae.domainlayer.place.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceImageEntity;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 갤러리 순서 — serialNum 은 자릿수가 다른 숫자 문자열(원천 일련번호) 또는 URL 해시(16진)라
 * 컬럼 사전순으로는 "10" 이 "2" 앞에 온다. 어댑터 정렬이 숫자 크기순을 지키는지 고정한다.
 */
class PlaceGalleryOrderTest {

    @Test
    @DisplayName("숫자 일련번호는 자릿수가 달라도 숫자 크기순으로 선다 — 사전순이면 10 이 2 앞에 온다")
    void numericSerialsSortNumerically() {
        assertThat(sort("10", "2", "1")).containsExactly("1", "2", "10");
    }

    @Test
    @DisplayName("해시 대체값은 숫자 일련번호 뒤에 사전순으로 고정된다 — 호출마다 같은 순서를 준다")
    void hashSerialsComeAfterNumericOnes() {
        assertThat(sort("f3a9", "2", "0b1c", "10")).containsExactly("2", "10", "0b1c", "f3a9");
    }

    private static List<String> sort(String... serialNums) {
        return Stream.of(serialNums)
            .map(serialNum -> PlaceImageEntity.builder().serialNum(serialNum).build())
            .sorted(PlaceRepositoryAdapter.GALLERY_ORDER)
            .map(PlaceImageEntity::getSerialNum)
            .toList();
    }
}
