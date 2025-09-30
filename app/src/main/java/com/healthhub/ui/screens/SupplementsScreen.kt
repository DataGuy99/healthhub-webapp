package com.healthhub.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.healthhub.ui.navigation.Screen

/**
 * Screen for managing supplements.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupplementsScreen(navController: NavController) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Supplements") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        },
        bottomBar = {
            BottomNavigationBar(navController = navController, currentRoute = Screen.Supplements.route)
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { /* TODO: Add supplement */ }) {
                Icon(Icons.Default.Add, contentDescription = "Add Supplement")
            }
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
                text = "Your Supplements",
                style = MaterialTheme.typography.headlineMedium
            )

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("No supplements added yet", style = MaterialTheme.typography.bodyMedium)
                    Text("Tap + to add your first supplement", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}