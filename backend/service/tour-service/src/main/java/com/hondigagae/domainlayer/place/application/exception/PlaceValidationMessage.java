package com.hondigagae.domainlayer.place.application.exception;

public final class PlaceValidationMessage {

    public static final String SIZE_POSITIVE = "PLACE_101:size는 1 이상이어야 합니다.";
    public static final String SIZE_MAX_INVALID = "PLACE_102:size는 50 이하만 가능합니다.";

    private PlaceValidationMessage() {
    }
}
