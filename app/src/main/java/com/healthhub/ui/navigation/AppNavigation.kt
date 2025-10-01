package com.healthhub.ui.navigation

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.runtime.Composable
import androidx.navigation.NavBackStackEntry
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.healthhub.ui.components.PageTransitions
import com.healthhub.ui.screens.DashboardScreen
import com.healthhub.ui.screens.MetricsScreen
import com.healthhub.ui.screens.SupplementsScreen
import com.healthhub.ui.screens.CorrelationsScreen

/**
 * Main navigation graph for the app with beautiful transitions.
 */
@OptIn(ExperimentalAnimationApi::class)
@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = Screen.Dashboard.route
    ) {
        composable(
            route = Screen.Dashboard.route,
            enterTransition = { fadeThrough() },
            exitTransition = { fadeThrough() }
        ) {
            DashboardScreen(navController = navController)
        }

        composable(
            route = Screen.Metrics.route,
            enterTransition = { fadeThrough() },
            exitTransition = { fadeThrough() }
        ) {
            MetricsScreen(navController = navController)
        }

        composable(
            route = Screen.Supplements.route,
            enterTransition = { fadeThrough() },
            exitTransition = { fadeThrough() }
        ) {
            SupplementsScreen(navController = navController)
        }

        composable(
            route = Screen.Correlations.route,
            enterTransition = { fadeThrough() },
            exitTransition = { fadeThrough() }
        ) {
            CorrelationsScreen(navController = navController)
        }
    }
}

/**
 * Fade through transition for smooth bottom nav changes.
 */
private fun AnimatedContentTransitionScope<NavBackStackEntry>.fadeThrough(): EnterTransition {
    return fadeIn(
        animationSpec = tween(220, delayMillis = 90, easing = LinearOutSlowInEasing)
    ) + scaleIn(
        initialScale = 0.92f,
        animationSpec = tween(220, delayMillis = 90, easing = FastOutSlowInEasing)
    )
}

private fun AnimatedContentTransitionScope<NavBackStackEntry>.fadeThrough(): ExitTransition {
    return fadeOut(
        animationSpec = tween(90, easing = FastOutLinearInEasing)
    ) + scaleOut(
        targetScale = 0.92f,
        animationSpec = tween(90, easing = FastOutLinearInEasing)
    )
}

/**
 * App navigation destinations.
 */
sealed class Screen(val route: String) {
    object Dashboard : Screen("dashboard")
    object Metrics : Screen("metrics")
    object Supplements : Screen("supplements")
    object Correlations : Screen("correlations")
}