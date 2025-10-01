package com.healthhub.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*

/**
 * Beautiful page transition animations.
 */
object PageTransitions {

    /**
     * Slide and fade transition for navigation.
     */
    fun slideAndFade(): ContentTransform {
        return slideInHorizontally(
            initialOffsetX = { fullWidth -> fullWidth },
            animationSpec = tween(300, easing = FastOutSlowInEasing)
        ) + fadeIn(
            animationSpec = tween(300)
        ) togetherWith slideOutHorizontally(
            targetOffsetX = { fullWidth -> -fullWidth / 3 },
            animationSpec = tween(300, easing = FastOutSlowInEasing)
        ) + fadeOut(
            animationSpec = tween(300)
        )
    }

    /**
     * Shared axis Z transition (like Material Design).
     */
    fun sharedAxisZ(): ContentTransform {
        return fadeIn(
            animationSpec = tween(210, delayMillis = 90, easing = LinearOutSlowInEasing)
        ) + scaleIn(
            initialScale = 0.92f,
            animationSpec = tween(300, easing = FastOutSlowInEasing)
        ) togetherWith fadeOut(
            animationSpec = tween(90, easing = FastOutLinearInEasing)
        ) + scaleOut(
            targetScale = 1.1f,
            animationSpec = tween(90, easing = FastOutLinearInEasing)
        )
    }

    /**
     * Fade through transition for bottom nav changes.
     */
    fun fadeThrough(): ContentTransform {
        return fadeIn(
            animationSpec = tween(210, delayMillis = 90, easing = LinearOutSlowInEasing)
        ) togetherWith fadeOut(
            animationSpec = tween(90, easing = FastOutLinearInEasing)
        )
    }

    /**
     * Elevator transition (vertical slide + fade).
     */
    fun elevator(): ContentTransform {
        return slideInVertically(
            initialOffsetY = { fullHeight -> fullHeight / 4 },
            animationSpec = tween(300, easing = FastOutSlowInEasing)
        ) + fadeIn(
            animationSpec = tween(300)
        ) togetherWith slideOutVertically(
            targetOffsetY = { fullHeight -> -fullHeight / 4 },
            animationSpec = tween(300, easing = FastOutSlowInEasing)
        ) + fadeOut(
            animationSpec = tween(300)
        )
    }
}