package com.hondigagae.domainlayer.planner.application.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.EnumSet;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * 요청 문구의 지역 (#1423). 실측 문구는 "성산 쪽 위주로 다니고 싶어요" — 권역 순서 제안이 이 요청을 덮었다.
 */
class RequestedRegionTest {

    @Test
    @DisplayName("지명 · 권역 이름 · 방향어를 권역으로 읽는다 — 낱말은 나온 순서, 권역은 선언 순서다")
    void readsWordsIntoZones() {
        RequestedRegion seongsan = RequestedRegion.from("성산 쪽 위주로 다니고 싶어요");
        assertThat(seongsan.words()).containsExactly("성산");
        assertThat(seongsan.zones()).containsExactly(JejuZone.NORTH_EAST);

        RequestedRegion twoPlaces = RequestedRegion.from("표선이랑 애월에서 쉬고 싶어요");
        assertThat(twoPlaces.words()).containsExactly("표선", "애월");
        assertThat(twoPlaces.zones()).containsExactly(JejuZone.NORTH_WEST, JejuZone.SOUTH_EAST);
        assertThat(twoPlaces.label()).isEqualTo("표선, 애월");

        assertThat(RequestedRegion.from("중문 근처 숙소").zones()).containsExactly(JejuZone.SOUTH_WEST);
        assertThat(RequestedRegion.from("한경면 노을 보고 싶어요").zones()).containsExactly(JejuZone.SOUTH_WEST);
        assertThat(RequestedRegion.from("노형 근처에서 마무리").zones()).containsExactly(JejuZone.NORTH);
        assertThat(RequestedRegion.from("고산 수월봉 노을").zones()).containsExactly(JejuZone.SOUTH_WEST);
        assertThat(RequestedRegion.from("우도 들어가고 싶어요").zones()).containsExactly(JejuZone.NORTH_EAST);
        assertThat(RequestedRegion.from("남동부 위주").zones()).containsExactly(JejuZone.SOUTH_EAST);
        assertThat(RequestedRegion.from("서쪽 해안 위주").zones()).containsExactly(JejuZone.NORTH_WEST, JejuZone.SOUTH_WEST);
        assertThat(RequestedRegion.from("산남 쪽으로").zones())
            .containsExactly(JejuZone.SOUTH_WEST, JejuZone.SOUTH, JejuZone.SOUTH_EAST);
        assertThat(RequestedRegion.from("동부 해안도로").zones()).containsExactly(JejuZone.NORTH_EAST, JejuZone.SOUTH_EAST);
        // 맨몸 방향어는 앞이 공백 · 문장 시작 · "제주", 뒤가 공백 · 이음말(로 …)일 때 읽는다
        assertThat(RequestedRegion.from("제주 동부 위주로").zones()).containsExactly(JejuZone.NORTH_EAST, JejuZone.SOUTH_EAST);
        assertThat(RequestedRegion.from("제주동부 위주로").zones()).containsExactly(JejuZone.NORTH_EAST, JejuZone.SOUTH_EAST);
        assertThat(RequestedRegion.from("동부로 가고 싶어요").zones()).containsExactly(JejuZone.NORTH_EAST, JejuZone.SOUTH_EAST);
        // 흔한 조사가 붙어도 읽는다 — 허용 목록일 때는 "서부랑 남부" 가 남쪽만 남았다
        assertThat(RequestedRegion.from("동부를 돌고 싶어요").zones()).containsExactly(JejuZone.NORTH_EAST, JejuZone.SOUTH_EAST);
        RequestedRegion westAndSouth = RequestedRegion.from("서부랑 남부 위주로");
        assertThat(westAndSouth.words()).containsExactly("서쪽", "남쪽");
        assertThat(westAndSouth.zones())
            .containsExactly(JejuZone.NORTH_WEST, JejuZone.SOUTH_WEST, JejuZone.SOUTH, JejuZone.SOUTH_EAST);
        // 세 글자 방향어는 한 권역이다 — "서쪽" 으로 읽혀 북서부까지 들던 것
        RequestedRegion southWest = RequestedRegion.from("남서쪽 해안");
        assertThat(southWest.words()).containsExactly("남서쪽");
        assertThat(southWest.zones()).containsExactly(JejuZone.SOUTH_WEST);
    }

    @Test
    @DisplayName("낱말은 사전의 대표 낱말로 적는다 — 같은 뜻의 다른 꼴이 두 번 적히지 않는다")
    void labelsWithRepresentativeWords() {
        RequestedRegion west = RequestedRegion.from("서쪽 해안이랑 서부 위주로");
        assertThat(west.words()).containsExactly("서쪽");
        assertThat(west.label()).isEqualTo("서쪽");

        assertThat(RequestedRegion.from("산남 쪽으로").words()).containsExactly("남쪽");
        assertThat(RequestedRegion.from("제주 동부 위주로").label()).isEqualTo("동쪽");
    }

    @Test
    @DisplayName("긴 낱말부터 맞추고 맞춘 구간은 지운다 — 북동부가 동부로, 서귀포시가 다른 낱말로 한 번 더 걸리지 않는다")
    void matchesLongerWordsFirst() {
        RequestedRegion northEast = RequestedRegion.from("북동부 위주로");
        assertThat(northEast.words()).containsExactly("북동부");
        assertThat(northEast.zones()).containsExactly(JejuZone.NORTH_EAST);

        RequestedRegion seogwipo = RequestedRegion.from("서귀포시 위주로 이동은 짧게");
        assertThat(seogwipo.words()).containsExactly("서귀포");
        assertThat(seogwipo.zones()).containsExactly(JejuZone.SOUTH);

        // 성산일출봉 — 일출봉(3자)이 먼저, 성산(2자)이 남은 자리에서. 둘 다 북동부라 권역은 하나
        RequestedRegion sunrise = RequestedRegion.from("성산일출봉 보고 싶어요");
        assertThat(sunrise.words()).containsExactly("성산", "일출봉");
        assertThat(sunrise.zones()).containsExactly(JejuZone.NORTH_EAST);
    }

    @Test
    @DisplayName("낱말 바로 뒤의 부정은 그 낱말을 버린다 — 쉼표와 다음 낱말을 넘지 않는다")
    void dropsNegatedWords() {
        RequestedRegion notAewol = RequestedRegion.from("애월 말고 서귀포 쪽으로");
        assertThat(notAewol.words()).containsExactly("서귀포");
        assertThat(notAewol.zones()).containsExactly(JejuZone.SOUTH);

        assertThat(RequestedRegion.from("서귀포는 빼고 애월").zones()).containsExactly(JejuZone.NORTH_WEST);
        assertThat(RequestedRegion.from("성산은 별로 싫어요")).isEqualTo(RequestedRegion.NONE);
        // 8자로는 놓쳤다 — 싫다는 지역으로 모으는 쪽이 좁히지 않는 쪽보다 나쁘다
        assertThat(RequestedRegion.from("애월은 사람 많아서 싫어요")).isEqualTo(RequestedRegion.NONE);
        assertThat(RequestedRegion.from("중문 제외").asksAnything()).isFalse();
        // 쉼표를 넘지 않는다 — 애월은 부정이 아니다
        assertThat(RequestedRegion.from("애월, 서귀포 말고").zones()).containsExactly(JejuZone.NORTH_WEST);
        // 다음 낱말을 넘지 않는다 — 부정은 바로 앞 낱말(서귀포)만 버린다
        assertThat(RequestedRegion.from("애월 서귀포 말고").zones()).containsExactly(JejuZone.NORTH_WEST);
        assertThat(RequestedRegion.from("애월은 별로")).isEqualTo(RequestedRegion.NONE);
        // 해요체 문장 끝에서 끊는다 — 마침표 없이 이어 쓴 다음 문장의 "싫" 이 표선을 버렸다
        assertThat(RequestedRegion.from("성산이랑 표선 위주로 해주세요 붐비는 건 싫어요").words()).containsExactly("성산", "표선");
        // "다" 뒤는 끊지 않는다 — 바다는 문장 끝이 아니다
        assertThat(RequestedRegion.from("애월 바다 싫어요")).isEqualTo(RequestedRegion.NONE);
    }

    @Test
    @DisplayName("\"아니면\" 은 부정이 아니다 — 맨몸 \"아니\" 가 성산을 버리고 서귀포만 남겼다")
    void alternativeIsNotNegation() {
        RequestedRegion either = RequestedRegion.from("성산 위주로 부탁해요 아니면 서귀포도 괜찮아요");

        assertThat(either.words()).containsExactly("성산", "서귀포");
        assertThat(either.zones()).containsExactly(JejuZone.NORTH_EAST, JejuZone.SOUTH);
        assertThat(RequestedRegion.from("성산이 아니라 서귀포로").words()).containsExactly("서귀포");
    }

    @ParameterizedTest
    @ValueSource(strings = {"제주 여행", "제주도 2박 3일", "제주도에서 바다 보며 산책", "한라산 보이는 곳"})
    @DisplayName("제주 · 제주도 단독과 한라산은 좁히지 않는다 — 섬 전체를 부르는 말이다")
    void wholeIslandWordsAreNotARegion(String note) {
        assertThat(RequestedRegion.from(note)).isEqualTo(RequestedRegion.NONE);
    }

    @ParameterizedTest
    @ValueSource(strings = {"사계절 내내 좋은 곳", "강아지 키우도록 넓은 곳", "10월정도에 가요", "편한경로로 부탁해요", "우도록 해 주세요",
        "최고산책로로 부탁해요", "공항에서 차 렌트해서 다녀요", "일정 연동해 주세요",
        "공항에서부터 시작해요", "숙소에서부터 가까운 곳", "운동부족이라 많이 걷고 싶어요", "이동부담 없이 다니고 싶어요",
        "이동부터 짧게 해 주세요", "남부럽지 않은 여행", "남부끄럽지 않게", "서부두 횟집 가고 싶어요", "이호텔 근처로 잡아 주세요",
        "강아지도두마리예요"})
    @DisplayName("다른 말 속 글자에 걸리는 이름은 앞뒤를 본다 — 사계절 · 키우도록 · 10월정도 · 편한경로 · 최고산책 · 에서부터 · 운동부족 · "
        + "이동부담 · 남부럽지 · 서부두 · 이호텔 · 도두마리, 공항 · 연동은 읽지 않는다")
    void ignoresWordsInsideOtherWords(String note) {
        assertThat(RequestedRegion.from(note)).isEqualTo(RequestedRegion.NONE);
    }

    @Test
    @DisplayName("빈 문구 · 지역 없는 문구는 아무것도 묻지 않는다")
    void noRegion() {
        assertThat(RequestedRegion.from(null)).isEqualTo(RequestedRegion.NONE);
        assertThat(RequestedRegion.from("  ")).isEqualTo(RequestedRegion.NONE);
        assertThat(RequestedRegion.from("오후엔 실내 카페에서 쉬고 싶어요").asksAnything()).isFalse();
        assertThat(RequestedRegion.NONE.reach()).isEmpty();
        assertThat(RequestedRegion.NONE.narrows()).isFalse();
        assertThat(RequestedRegion.NONE.label()).isEmpty();
    }

    @Test
    @DisplayName("맞닿은 권역까지가 reach 다 — 섬 전체가 되면 풀을 좁히지 않는다")
    void reachAndNarrows() {
        RequestedRegion seongsan = RequestedRegion.from("성산 위주");
        assertThat(seongsan.reach()).containsExactly(JejuZone.NORTH, JejuZone.NORTH_EAST, JejuZone.SOUTH_EAST);
        assertThat(seongsan.narrows()).isTrue();

        RequestedRegion west = RequestedRegion.from("서쪽");
        assertThat(west.reach())
            .containsExactlyInAnyOrderElementsOf(EnumSet.of(JejuZone.NORTH_WEST, JejuZone.NORTH, JejuZone.SOUTH_WEST, JejuZone.SOUTH));
        assertThat(west.narrows()).isTrue();

        // 남쪽 세 권역에 맞닿은 북서부 · 북동부까지 더해도 북부는 빠진다 — 북부-남부는 한라산 너머라 맞닿지 않는다
        RequestedRegion south = RequestedRegion.from("남쪽 위주");
        assertThat(south.reach()).hasSize(JejuZone.values().length - 1).doesNotContain(JejuZone.NORTH);
        assertThat(south.narrows()).isTrue();

        // 서쪽 끝(북서부)과 동쪽 끝(남동부)을 함께 부르면 맞닿은 권역까지가 섬 전체다
        RequestedRegion bothEnds = RequestedRegion.from("애월이랑 남원");
        assertThat(bothEnds.asksAnything()).isTrue();
        assertThat(bothEnds.narrows()).isFalse();
    }
}
