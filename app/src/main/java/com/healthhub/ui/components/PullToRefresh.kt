package com.healthhub.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

/**
 * Pull-to-refresh with beautiful animations.
 */
@Composable
fun PullToRefreshContainer(
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    var refreshTrigger by remember { mutableStateOf(false) }
    var offsetY by remember { mutableFloatStateOf(0f) }
    val maxPullDistance = with(LocalDensity.current) { 120.dp.toPx() }

    val animatedOffsetY by animateFloatAsState(
        targetValue = if (isRefreshing) maxPullDistance / 2 else 0f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMedium
        ),
        label = "refresh_offset"
    )

    val nestedScrollConnection = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (isRefreshing) return Offset.Zero

                val delta = available.y
                if (offsetY > 0f && delta < 0) {
                    val consumed = offsetY + delta
                    offsetY = consumed.coerceAtLeast(0f)
                    return Offset(0f, available.y - consumed.coerceAtLeast(-delta))
                }
                return Offset.Zero
            }

            override fun onPostScroll(
                consumed: Offset,
                available: Offset,
                source: NestedScrollSource
            ): Offset {
                if (isRefreshing) return Offset.Zero

                val delta = available.y
                if (delta > 0) {
                    offsetY = (offsetY + delta).coerceAtMost(maxPullDistance)
                    return Offset(0f, delta)
                }
                return Offset.Zero
            }

            override suspend fun onPreFling(available: androidx.compose.ui.unit.Velocity): androidx.compose.ui.unit.Velocity {
                if (offsetY >= maxPullDistance * 0.8f && !isRefreshing) {
                    refreshTrigger = true
                    onRefresh()
                }
                offsetY = 0f
                return super.onPreFling(available)
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .nestedScroll(nestedScrollConnection)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .offset { IntOffset(0, (if (isRefreshing) animatedOffsetY else offsetY).roundToInt()) }
        ) {
            content()
        }

        // Refresh indicator
        if (offsetY > 0f || isRefreshing) {
            RefreshIndicator(
                isRefreshing = isRefreshing,
                progress = (offsetY / maxPullDistance).coerceIn(0f, 1f),
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .offset { IntOffset(0, (if (isRefreshing) animatedOffsetY else offsetY / 2).roundToInt()) }
            )
        }
    }
}

@Composable
private fun RefreshIndicator(
    isRefreshing: Boolean,
    progress: Float,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "refresh_spin")
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "refresh_rotation"
    )

    val scale by animateFloatAsState(
        targetValue = if (isRefreshing) 1f else progress,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy),
        label = "refresh_scale"
    )

    Box(
        modifier = modifier
            .size(48.dp)
            .scale(scale)
            .rotate(if (isRefreshing) rotation else progress * 360f),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            progress = { if (isRefreshing) 1f else progress },
            modifier = Modifier.size(32.dp),
            color = MaterialTheme.colorScheme.primary,
            strokeWidth = 3.dp,
        )
    }
}