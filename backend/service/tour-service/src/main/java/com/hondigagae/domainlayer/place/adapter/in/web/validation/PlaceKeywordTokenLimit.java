package com.hondigagae.domainlayer.place.adapter.in.web.validation;

import com.hondigagae.domainlayer.place.application.exception.PlaceValidationMessage;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Documented
@Constraint(validatedBy = PlaceKeywordTokenLimitValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface PlaceKeywordTokenLimit {

    String message() default PlaceValidationMessage.KEYWORD_TOKEN_MAX_INVALID;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
