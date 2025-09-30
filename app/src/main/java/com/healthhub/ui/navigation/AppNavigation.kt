package com.healthhub.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.healthhub.ui.screens.DashboardScreen
import com.healthhub.ui.screens.MetricsScreen
import com.healthhub.ui.screens.SupplementsScreen
import com.healthhub.ui.screens.CorrelationsScreen

/**
 * Main navigation graph for the app.
 */
@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = Screen.Dashboard.route
    ) {
        composable(Screen.Dashboard.route) {
            DashboardScreen(navController = navController)
        }

        composable(Screen.Metrics.route) {
            MetricsScreen(navController = navController)
        }

        composable(Screen.Supplements.route) {
            SupplementsScreen(navController = navController)
        }

        composable(Screen.Correlations.route) {
            CorrelationsScreen(navController = navController)
        }
    }
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