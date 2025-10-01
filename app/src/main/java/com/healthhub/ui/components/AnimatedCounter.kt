package com.healthhub.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.text.TextStyle

/**
 * Animated counter that rolls numbers when value changes.
 */
@Composable
fun AnimatedCounter(
    value: String,
    style: TextStyle,
    modifier: androidx.compose.ui.Modifier = androidx.compose.ui.Modifier
) {
    var previousValue by remember { mutableStateOf(value) }

    LaunchedEffect(value) {
        if (value != previousValue) {
            previousValue = value
        }
    }

    AnimatedContent(
        targetState = value,
        transitionSpec = {
            if (targetState > previousValue) {
                // Slide up when increasing
                slideInVertically { height -> height } + fadeIn() togetherWith
                        slideOutVertically { height -> -height } + fadeOut()
            } else {
                // Slide down when decreasing
                slideInVertically { height -> -height } + fadeIn() togetherWith
                        slideOutVertically { height -> height } + fadeOut()
            }.using(
                SizeTransform(clip = false)
            )
        },
        label = "counter_animation"
    ) { targetValue ->
        Text(
            text = targetValue,
            style = style,
            modifier = modifier
        )
    }
}