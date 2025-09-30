package com.healthhub.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.healthhub.ui.navigation.Screen

/**
 * Main dashboard screen showing overview of health data.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(navController: NavController) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("HealthHub") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        },
        bottomBar = {
            BottomNavigationBar(navController = navController, currentRoute = Screen.Dashboard.route)
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Welcome to HealthHub",
                style = MaterialTheme.typography.headlineMedium
            )

            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Today's Summary", style = MaterialTheme.typography.titleLarge)
                    Text("Health data will appear here once synced.", style = MaterialTheme.typography.bodyMedium)
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Active Supplements", style = MaterialTheme.typography.titleLarge)
                    Text("No supplements logged yet.", style = MaterialTheme.typography.bodyMedium)
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Top Correlations", style = MaterialTheme.typography.titleLarge)
                    Text("Correlations will appear after collecting enough data.", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
fun BottomNavigationBar(navController: NavController, currentRoute: String) {
    NavigationBar {
        NavigationBarItem(
            icon = { Icon(Icons.Default.Home, contentDescription = "Dashboard") },
            label = { Text("Dashboard") },
            selected = currentRoute == Screen.Dashboard.route,
            onClick = { navController.navigate(Screen.Dashboard.route) }
        )
        NavigationBarItem(
            icon = { Icon(Icons.Default.Favorite, contentDescription = "Metrics") },
            label = { Text("Metrics") },
            selected = currentRoute == Screen.Metrics.route,
            onClick = { navController.navigate(Screen.Metrics.route) }
        )
        NavigationBarItem(
            icon = { Icon(Icons.Default.Star, contentDescription = "Supplements") },
            label = { Text("Supplements") },
            selected = currentRoute == Screen.Supplements.route,
            onClick = { navController.navigate(Screen.Supplements.route) }
        )
        NavigationBarItem(
            icon = { Icon(Icons.Default.Search, contentDescription = "Correlations") },
            label = { Text("Correlations") },
            selected = currentRoute == Screen.Correlations.route,
            onClick = { navController.navigate(Screen.Correlations.route) }
        )
    }
}