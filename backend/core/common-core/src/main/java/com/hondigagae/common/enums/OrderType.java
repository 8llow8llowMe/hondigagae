package com.hondigagae.common.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum OrderType implements CodeNameDescribable {
    ASC("오름차순"),
    DESC("내림차순");

    private final String displayName;
}
