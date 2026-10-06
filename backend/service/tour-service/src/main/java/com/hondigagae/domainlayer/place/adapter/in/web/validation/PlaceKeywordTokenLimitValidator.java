package com.hondigagae.domainlayer.place.adapter.in.web.validation;

import com.hondigagae.domainlayer.place.application.model.PlaceKeyword;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class PlaceKeywordTokenLimitValidator implements ConstraintValidator<PlaceKeywordTokenLimit, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return PlaceKeyword.hasValidTokenCount(value);
    }
}
