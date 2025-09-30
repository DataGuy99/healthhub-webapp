package com.healthhub.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.healthhub.ui.navigation.Screen

/**
 * Screen for viewing correlations between metrics and supplements.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CorrelationsScreen(navController: NavController) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Correlations") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        },
        bottomBar = {
            BottomNavigationBar(navController = navController, currentRoute = Screen.Correlations.route)
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Metric Correlations",
                style = MaterialTheme.typography.headlineMedium
            )

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("No correlations calculated yet", style = MaterialTheme.typography.bodyMedium)
                    Text("Correlations will appear after collecting enough data over time.", style = MaterialTheme.typography.bodySmall)
                }
            }

            Text(
                text = "How it works:",
                style = MaterialTheme.typography.titleMedium
            )

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("• HealthHub analyzes relationships between your supplements and health metrics", style = MaterialTheme.typography.bodySmall)
                    Text("• Minimum 10 data points required for correlation", style = MaterialTheme.typography.bodySmall)
                    Text("• Lag analysis shows delayed effects (1h, 6h, 24h, 7d)", style = MaterialTheme.typography.bodySmall)
                    Text("• Statistical significance is calculated (p-value)", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}